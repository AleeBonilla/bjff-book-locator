import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';

import { useAdmin } from '../AdminContext';
import type { SchemeWorkspaceContext } from '../components/WorkflowLayout';
import type { ReplaceLevelInput } from '../types';

const initialLevels = ['Piso', 'Fila', 'Cara', 'Mueble', 'Anaquel'];

function levelInputs(names: string[], terminalIndex: number): ReplaceLevelInput[] {
  return names.map((name, index) => ({
    key: `level-${index + 1}`,
    parentKey: index === 0 ? null : `level-${index}`,
    name,
    sortOrder: index + 1,
    isSearchTerminal: index === terminalIndex,
  }));
}

export function LevelsScreen() {
  const { scheme } = useOutletContext<SchemeWorkspaceContext>();
  const { gateway, commit } = useAdmin();
  const navigate = useNavigate();
  const [names, setNames] = useState<string[]>(initialLevels);
  const [terminalIndex, setTerminalIndex] = useState(4);
  const editable = scheme.status === 'DRAFT' && !scheme.publishedAt;

  useEffect(() => {
    if (scheme.levels.length) {
      setNames(scheme.levels.map((level) => level.name));
      setTerminalIndex(Math.max(0, scheme.levels.findIndex((level) => level.isSearchTerminal)));
    }
  }, [scheme.levels]);

  function updateName(index: number, name: string) {
    setNames((current) => current.map((item, itemIndex) => itemIndex === index ? name : item));
  }

  function removeLevel(index: number) {
    setNames((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setTerminalIndex((current) => Math.min(current, Math.max(0, names.length - 2)));
  }

  async function save(confirm: boolean) {
    try {
      await commit(gateway.replaceLevels(scheme.id, levelInputs(names, terminalIndex)), 'Niveles guardados.');
      if (confirm) {
        await commit(gateway.confirmLevels(scheme.id), 'Niveles confirmados.');
        navigate(`/admin/schemes/${scheme.id}/locations`);
      }
    } catch {
      // El gateway ya presentó el error funcional.
    }
  }

  return (
    <section className="admin-stage" aria-labelledby="levels-title">
      <div className="admin-stage-heading">
        <div><h2 id="levels-title">Definir niveles</h2><p>Selecciona dónde se capturan directamente los rangos.</p></div>
        {editable ? <button className="admin-button admin-button--quiet" type="button" onClick={() => setNames((current) => [...current, `Nivel ${current.length + 1}`])}>Añadir nivel</button> : null}
      </div>

      <div className="admin-card admin-level-list">
        {names.map((name, index) => (
          <div className="admin-level-row" key={`level-${index}`} style={{ '--level-depth': `${index * 26}px` } as React.CSSProperties}>
            <label className="admin-level-identity">
              <span className="admin-level-number">{String(index + 1).padStart(2, '0')}</span>
              <input aria-label={`Nombre del nivel ${index + 1}`} value={name} onChange={(event) => updateName(index, event.target.value)} disabled={!editable} />
            </label>
            <label className="admin-terminal-choice">
              <input type="radio" name="terminal-level" checked={terminalIndex === index} onChange={() => setTerminalIndex(index)} disabled={!editable} />
              Captura rangos
            </label>
            {editable && names.length > 1 ? <button className="admin-icon-button" type="button" aria-label={`Eliminar ${name}`} onClick={() => removeLevel(index)}>×</button> : null}
          </div>
        ))}
      </div>

      <div className="admin-summary-strip">
        <strong>Precisión de búsqueda</strong>
        <span>Los rangos se asignarán en {names[terminalIndex] || 'el nivel seleccionado'}; la cobertura superior se calculará.</span>
      </div>

      {editable ? (
        <div className="admin-form-actions">
          <button className="admin-button admin-button--quiet" type="button" onClick={() => void save(false)}>Guardar</button>
          <button className="admin-button" type="button" onClick={() => void save(true)}>Confirmar niveles</button>
        </div>
      ) : (
        <p className="admin-locked-note">Los niveles están confirmados.</p>
      )}
    </section>
  );
}
