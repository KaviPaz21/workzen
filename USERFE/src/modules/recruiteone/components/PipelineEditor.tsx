import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { defaultInterviewerIds } from '../data/people'
import type { Pipeline, PipelineStage } from '../types'
import { InterviewerPicker } from './InterviewerPicker'

function newStage(): PipelineStage {
  return { id: `st-${crypto.randomUUID().slice(0, 6)}`, name: '', max_candidates: 10, interviewer_ids: [...defaultInterviewerIds], scheduled_date: null }
}

export function emptyPipeline(): Pipeline {
  return { name: '', description: '', stages: [newStage()] }
}

export function isPipelineValid(pipeline: Pipeline) {
  return (
    pipeline.name.trim().length > 0 &&
    pipeline.stages.length > 0 &&
    pipeline.stages.every((stage) => stage.name.trim().length > 0 && stage.max_candidates >= 1 && stage.interviewer_ids.length > 0)
  )
}

interface PipelineEditorProps {
  value: Pipeline
  onChange: (pipeline: Pipeline) => void
}

export function PipelineEditor({ value, onChange }: PipelineEditorProps) {
  function updateStage(id: string, changes: Partial<PipelineStage>) {
    onChange({ ...value, stages: value.stages.map((stage) => (stage.id === id ? { ...stage, ...changes } : stage)) })
  }

  return (
    <div className="pipeline-editor">
      <div className="pipeline-editor__basics">
        <label className="field">
          <span className="field__label">Pipeline name</span>
          <input className="input" value={value.name} placeholder="For example, Engineering hiring" onChange={(event) => onChange({ ...value, name: event.target.value })} />
        </label>
        <label className="field">
          <span className="field__label">Description</span>
          <textarea
            className="textarea"
            rows={2}
            value={value.description}
            placeholder="What this pipeline is for"
            onChange={(event) => onChange({ ...value, description: event.target.value })}
          />
        </label>
      </div>

      <ol className="stage-list">
        {value.stages.map((stage, index) => (
          <li key={stage.id} className="stage">
            <div className="stage__head">
              <span className="stage__number">{index + 1}</span>
              <span className="stage__title">Stage {index + 1}</span>
              <button
                type="button"
                className="icon-button icon-button--small"
                aria-label={`Delete stage ${index + 1}`}
                disabled={value.stages.length === 1}
                onClick={() => onChange({ ...value, stages: value.stages.filter((item) => item.id !== stage.id) })}
              >
                <Trash2 />
              </button>
            </div>
            <div className="stage__fields">
              <label className="field">
                <span className="field__label">Stage name</span>
                <input
                  className="input"
                  value={stage.name}
                  placeholder="For example, Technical interview"
                  onChange={(event) => updateStage(stage.id, { name: event.target.value })}
                />
              </label>
              <label className="field">
                <span className="field__label">Max candidates</span>
                <input
                  className="input"
                  type="number"
                  min={1}
                  value={stage.max_candidates}
                  onChange={(event) => updateStage(stage.id, { max_candidates: Math.max(1, Number(event.target.value) || 1) })}
                />
              </label>
            </div>
            <label className="field stage__date">
              <span className="field__label">Schedule date</span>
              <input
                className="input"
                type="date"
                value={stage.scheduled_date ?? ''}
                onChange={(event) => updateStage(stage.id, { scheduled_date: event.target.value || null })}
              />
            </label>
            <div className="field">
              <span className="field__label">Interviewers</span>
              <InterviewerPicker
                label={stage.name || `stage ${index + 1}`}
                selectedIds={stage.interviewer_ids}
                onChange={(ids) => updateStage(stage.id, { interviewer_ids: ids })}
              />
            </div>
          </li>
        ))}
      </ol>

      <Button variant="secondary" size="sm" icon={<Plus />} onClick={() => onChange({ ...value, stages: [...value.stages, newStage()] })}>
        Add stage
      </Button>
    </div>
  )
}
