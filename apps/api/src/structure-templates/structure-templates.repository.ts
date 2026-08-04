import { Inject, Injectable } from '@nestjs/common';
import type { Insertable, Updateable } from 'kysely';

import { translateDatabaseError } from '../common/api-error.js';
import { DATABASE, type Db } from '../database/database.module.js';
import type { Tx } from '../database/transaction.js';
import type {
  StructureTemplateNodesTable,
  StructureTemplateNodeRow,
  StructureTemplateRow,
  StructureTemplatesTable,
} from '../database/schema.types.js';

export type TemplateWithCreator = StructureTemplateRow & {
  creator_username: string | null;
};

@Injectable()
export class StructureTemplatesRepository {
  constructor(@Inject(DATABASE) private readonly db: Db) {}

  async list(options: {
    status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
    enabled?: boolean;
    limit: number;
    offset: number;
  }): Promise<{ rows: TemplateWithCreator[]; total: number }> {
    let query = this.db
      .selectFrom('structure_templates')
      .leftJoin('users', 'users.user_id', 'structure_templates.created_by')
      .selectAll('structure_templates')
      .select('users.username as creator_username');
    let countQuery = this.db
      .selectFrom('structure_templates')
      .select((eb) => eb.fn.countAll<number>().as('count'));

    if (options.status) {
      query = query.where('structure_templates.status', '=', options.status);
      countQuery = countQuery.where('status', '=', options.status);
    }
    if (options.enabled !== undefined) {
      query = query.where('structure_templates.enabled', '=', options.enabled);
      countQuery = countQuery.where('enabled', '=', options.enabled);
    }

    const [rows, count] = await Promise.all([
      query
        .orderBy('structure_templates.updated_at', 'desc')
        .orderBy('structure_templates.structure_template_id', 'desc')
        .limit(options.limit)
        .offset(options.offset)
        .execute(),
      countQuery.executeTakeFirstOrThrow(),
    ]);
    return { rows, total: Number(count.count) };
  }

  async template(id: number): Promise<TemplateWithCreator | undefined> {
    return this.db
      .selectFrom('structure_templates')
      .leftJoin('users', 'users.user_id', 'structure_templates.created_by')
      .selectAll('structure_templates')
      .select('users.username as creator_username')
      .where('structure_templates.structure_template_id', '=', id)
      .executeTakeFirst();
  }

  nodes(templateId: number): Promise<StructureTemplateNodeRow[]> {
    return this.db
      .selectFrom('structure_template_nodes')
      .selectAll()
      .where('structure_template_id', '=', templateId)
      .orderBy('sort_order', 'asc')
      .orderBy('structure_template_node_id', 'asc')
      .execute();
  }

  async create(
    values: Insertable<StructureTemplatesTable>,
  ): Promise<StructureTemplateRow> {
    return this.translated(() =>
      this.db
        .insertInto('structure_templates')
        .values(values)
        .returningAll()
        .executeTakeFirstOrThrow(),
    );
  }

  async update(
    templateId: number,
    values: Updateable<StructureTemplatesTable>,
  ): Promise<void> {
    await this.translated(() =>
      this.db
        .updateTable('structure_templates')
        .set({ ...values, updated_at: new Date() })
        .where('structure_template_id', '=', templateId)
        .execute(),
    );
  }

  async createNode(
    templateId: number,
    values: Omit<Insertable<StructureTemplateNodesTable>, 'structure_template_id'>,
    requestedPosition?: number,
  ): Promise<StructureTemplateNodeRow> {
    return this.translated(() =>
      this.db.transaction().execute(async (tx) => {
        const parentId = values.parent_template_node_id ?? null;
        const siblings = await tx
          .selectFrom('structure_template_nodes')
          .select('structure_template_node_id')
          .where('structure_template_id', '=', templateId)
          .where('parent_template_node_id', parentId === null ? 'is' : '=', parentId)
          .orderBy('sort_order', 'asc')
          .execute();
        const created = await tx
          .insertInto('structure_template_nodes')
          .values({
            ...values,
            structure_template_id: templateId,
            sort_order: siblings.length,
          })
          .returningAll()
          .executeTakeFirstOrThrow();
        const ordered = siblings.map((row) => row.structure_template_node_id);
        ordered.splice(
          Math.min(requestedPosition ?? ordered.length, ordered.length),
          0,
          created.structure_template_node_id,
        );
        await this.writeOrder(tx, ordered);
        return created;
      }),
    );
  }

  async updateNode(
    nodeId: number,
    values: Updateable<StructureTemplateNodesTable>,
  ): Promise<void> {
    await this.translated(() =>
      this.db
        .updateTable('structure_template_nodes')
        .set({ ...values, updated_at: new Date() })
        .where('structure_template_node_id', '=', nodeId)
        .execute(),
    );
  }

  async moveNode(
    templateId: number,
    nodeId: number,
    parentId: number | null,
    position: number,
  ): Promise<void> {
    await this.translated(() =>
      this.db.transaction().execute(async (tx) => {
        const node = await tx
          .selectFrom('structure_template_nodes')
          .select(['parent_template_node_id'])
          .where('structure_template_id', '=', templateId)
          .where('structure_template_node_id', '=', nodeId)
          .executeTakeFirstOrThrow();
        const oldParent = node.parent_template_node_id;
        const target = await tx
          .selectFrom('structure_template_nodes')
          .select('structure_template_node_id')
          .where('structure_template_id', '=', templateId)
          .where('parent_template_node_id', parentId === null ? 'is' : '=', parentId)
          .where('structure_template_node_id', '!=', nodeId)
          .orderBy('sort_order', 'asc')
          .execute();

        await tx
          .updateTable('structure_template_nodes')
          .set({
            parent_template_node_id: parentId,
            sort_order: -nodeId,
            updated_at: new Date(),
          })
          .where('structure_template_node_id', '=', nodeId)
          .execute();

        if (oldParent !== parentId) {
          const old = await tx
            .selectFrom('structure_template_nodes')
            .select('structure_template_node_id')
            .where('structure_template_id', '=', templateId)
            .where('parent_template_node_id', oldParent === null ? 'is' : '=', oldParent)
            .where('structure_template_node_id', '!=', nodeId)
            .orderBy('sort_order', 'asc')
            .execute();
          await this.writeOrder(
            tx,
            old.map((row) => row.structure_template_node_id),
          );
        }

        const ordered = target.map((row) => row.structure_template_node_id);
        ordered.splice(Math.min(position, ordered.length), 0, nodeId);
        await this.writeOrder(tx, ordered);
      }),
    );
  }

  async orderNodes(orderedIds: number[]): Promise<void> {
    await this.translated(() =>
      this.db.transaction().execute((tx) => this.writeOrder(tx, orderedIds)),
    );
  }

  async deleteNodes(idsDepthFirst: number[]): Promise<void> {
    await this.translated(() =>
      this.db.transaction().execute(async (tx) => {
        for (const id of [...idsDepthFirst].reverse()) {
          await tx
            .deleteFrom('structure_template_nodes')
            .where('structure_template_node_id', '=', id)
            .execute();
        }
      }),
    );
  }

  private async writeOrder(db: Tx, orderedIds: number[]): Promise<void> {
    for (const id of orderedIds) {
      await db
        .updateTable('structure_template_nodes')
        .set({ sort_order: -id })
        .where('structure_template_node_id', '=', id)
        .execute();
    }
    for (const [position, id] of orderedIds.entries()) {
      await db
        .updateTable('structure_template_nodes')
        .set({ sort_order: position, updated_at: new Date() })
        .where('structure_template_node_id', '=', id)
        .execute();
    }
  }

  private async translated<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      const translated = translateDatabaseError(error);
      if (translated) throw translated;
      throw error;
    }
  }
}
