import { memo, useCallback, useRef, useState } from "react";
import styled from "styled-components";
import { StatusChip } from "components/apps/OwlAgents/components/Badges";
import { Note } from "components/apps/OwlAgents/components/primitives";
import {
  useOwlServices,
  useProjects,
  useSourcesInIntake,
} from "components/apps/OwlAgents/hooks/useOwlData";
import { OWL_TOKENS } from "components/apps/OwlAgents/theme";
import { useFileSystem } from "contexts/fileSystem";
import { INTAKE_STAGE_LABELS } from "owlagents/domain/authority";

const Zone = styled.section<{ $active: boolean }>`
  border: 1px dashed
    ${({ $active }) =>
      $active ? OWL_TOKENS.accent.owlagents : OWL_TOKENS.color.borderStrong};
  border-radius: ${OWL_TOKENS.radius.card};
  margin: 0 ${OWL_TOKENS.space.lg} ${OWL_TOKENS.space.md};
  padding: ${OWL_TOKENS.space.md};
`;

const Controls = styled.div`
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: ${OWL_TOKENS.space.sm};

  > label {
    color: ${OWL_TOKENS.color.textDim};
    font-size: ${OWL_TOKENS.font.sectionSize};
    letter-spacing: ${OWL_TOKENS.font.sectionTracking};
    text-transform: uppercase;
  }

  > select,
  > button {
    background-color: ${OWL_TOKENS.color.surface3};
    border: 1px solid ${OWL_TOKENS.color.borderStrong};
    border-radius: ${OWL_TOKENS.radius.control};
    color: ${OWL_TOKENS.color.text};
    font-family: inherit;
    font-size: inherit;
    padding: 4px ${OWL_TOKENS.space.sm};

    &:focus-visible {
      outline: 1px solid ${OWL_TOKENS.color.focusRing};
      outline-offset: -1px;
    }
  }
`;

const Progress = styled.ol`
  list-style: none;
  margin: ${OWL_TOKENS.space.sm} 0 0;
  padding: 0;

  > li {
    align-items: center;
    color: ${OWL_TOKENS.color.textMuted};
    display: flex;
    gap: ${OWL_TOKENS.space.sm};
    padding: 2px 0;
  }
`;

const SOURCES_ROOT = "/OwlAgents/Sources";

/** Real SHA-256 of the actual bytes — the hash is measured, never invented. */
const sha256 = async (buffer: ArrayBuffer): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", buffer);

  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

/**
 * Governed intake, distinct from a file copy.
 *
 * Dropping a file into the folder on the left is a filesystem operation and
 * stays one. Dropping it here starts an intake: the bytes are hashed, preserved
 * to the sources mount, and then walked through
 * `received → hashing → preserved → classifying → policy checked → assigned →
 * ready`, one committed transition and one ledger event per stage.
 *
 * Each advance is triggered by that stage's work actually completing — there is
 * no timer, and the file is not authoritative until it reaches `ready`.
 */
const IntakeZone: FC<{ projectId: string }> = ({ projectId }) => {
  const services = useOwlServices();
  const { mkdirRecursive, writeFile } = useFileSystem();
  const projects = useProjects();
  const inFlight = useSourcesInIntake();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [active, setActive] = useState(false);
  const [target, setTarget] = useState(projectId);
  const [error, setError] = useState("");

  const ingest = useCallback(
    async (files: readonly File[]): Promise<void> => {
      setError("");

      for (const file of files) {
        try {
          // eslint-disable-next-line no-await-in-loop
          const buffer = await file.arrayBuffer();
          // eslint-disable-next-line no-await-in-loop
          const hash = await sha256(buffer);
          const folder = `${SOURCES_ROOT}/${target}`;
          const path = `${folder}/${file.name}`;

          // eslint-disable-next-line no-await-in-loop
          await mkdirRecursive(folder);
          // eslint-disable-next-line no-await-in-loop
          await writeFile(path, Buffer.from(buffer), true);

          // eslint-disable-next-line no-await-in-loop
          const received = await services.sourceService.ingest({
            hash,
            name: file.name,
            path,
            projectId: target,
            size: file.size,
          });

          if (!received.ok) {
            setError(received.error.message);

            return;
          }

          // One advance per stage that has actually been completed.
          for (let step = 0; step < 6; step += 1) {
            // eslint-disable-next-line no-await-in-loop
            const advanced = await services.sourceService.advanceIntake(
              received.data.objectId
            );

            if (!advanced.ok) break;
          }
        } catch {
          setError(
            `${file.name} could not be hashed or preserved, so nothing was recorded.`
          );
        }
      }
    },
    [mkdirRecursive, services, target, writeFile]
  );

  return (
    <Zone
      $active={active}
      aria-label="Source intake"
      onDragLeave={() => setActive(false)}
      onDragOver={(event) => {
        event.preventDefault();
        setActive(true);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setActive(false);
        ingest([...event.dataTransfer.files]);
      }}
    >
      <Controls>
        <label htmlFor="owl-intake-project">Intake into</label>
        <select
          id="owl-intake-project"
          onChange={(event) => setTarget(event.target.value)}
          value={target}
        >
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.id} · {project.name}
            </option>
          ))}
        </select>
        <button onClick={() => inputRef.current?.click()} type="button">
          Choose a file
        </button>
        <input
          ref={inputRef}
          onChange={(event) => {
            ingest([...(event.target.files ?? [])]).finally(() => {
              // Reset through the ref so the same file can be re-selected.
              if (inputRef.current) inputRef.current.value = "";
            });
          }}
          type="file"
          hidden
          multiple
        />
      </Controls>
      <Note>
        Drop a file here to begin a governed intake. It is hashed and preserved
        first, then classified and policy-checked — it is not authoritative
        until it reaches Ready.
      </Note>
      {error ? <Note>{error}</Note> : undefined}
      {inFlight.length > 0 ? (
        <Progress aria-label="Intake in progress">
          {inFlight.map((source) => (
            <li key={source.id}>
              <StatusChip
                label={INTAKE_STAGE_LABELS[source.intakeStage]}
                status={source.intakeStage === "failed" ? "blocked" : "running"}
              />
              {source.id} · {source.name}
            </li>
          ))}
        </Progress>
      ) : undefined}
    </Zone>
  );
};

export default memo(IntakeZone);
