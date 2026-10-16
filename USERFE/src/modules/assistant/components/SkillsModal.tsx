import { Play } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import type { SkillInfo } from '../types'

interface SkillsModalProps {
  skills: SkillInfo[]
  activeSkill: string | null
  onStart: (skillId: string, message: string) => void
  onClose: () => void
}

const minimumLength = 8

export function messageFor(skill: SkillInfo, optionId: string | null, text: string): string {
  const task = text.trim()
  if (skill.id !== 'drafting') return task
  if (optionId === 'excel') return `Create an Excel file: ${task}`
  if (optionId === 'document') return `Write a Word document: ${task}`
  return `Draft an email: ${task}`
}

export function SkillsModal({ skills, activeSkill, onStart, onClose }: SkillsModalProps) {
  const [selectedId, setSelectedId] = useState(activeSkill ?? skills[0]?.id ?? '')
  const [optionId, setOptionId] = useState<string | null>(null)
  const [text, setText] = useState('')
  const skill = skills.find((item) => item.id === selectedId) ?? skills[0]

  useEffect(() => {
    setOptionId(skill?.options[0]?.id ?? null)
    setText('')
  }, [skill?.id])

  if (!skill) return null
  const ready = text.trim().length >= minimumLength

  return (
    <Modal
      open
      onClose={onClose}
      title="Co-worker skills"
      description="Pick the kind of work and describe the task. Co-worker follows a method made for it."
      footer={
        <>
          <span className="modal__footer-spacer" />
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!ready} onClick={() => onStart(skill.id, messageFor(skill, optionId, text))}>
            <Play aria-hidden="true" />
            Start
          </Button>
        </>
      }
    >
      <div className="skills">
        <nav className="skills__menu" aria-label="Skills">
          {skills.map((item) => (
            <button key={item.id} type="button" className={`skills__item${item.id === skill.id ? ' skills__item--on' : ''}`} aria-current={item.id === skill.id ? 'true' : undefined} onClick={() => setSelectedId(item.id)}>
              <strong>{item.label}</strong>
              <small>{item.summary}</small>
            </button>
          ))}
        </nav>

        <section className="skills__detail" aria-label={skill.label}>
          <h3>{skill.label}</h3>
          <p>{skill.detail}</p>

          {skill.options.length > 0 && (
            <div className="skills__options" role="radiogroup" aria-label={`${skill.label} type`}>
              {skill.options.map((option) => (
                <button key={option.id} type="button" role="radio" aria-checked={option.id === optionId} className={`skills__option${option.id === optionId ? ' skills__option--on' : ''}`} onClick={() => setOptionId(option.id)}>
                  <strong>{option.label}</strong>
                  <small>{option.hint}</small>
                </button>
              ))}
            </div>
          )}

          <label className="skills__field">
            <span>{skill.id === 'testing' ? 'What should be tested?' : skill.id === 'bi' ? 'What do you want to build or fix?' : 'What do you need drafted?'}</span>
            <textarea value={text} rows={5} placeholder="Describe it in your own words. Co-worker will ask if something is missing." onChange={(event) => setText(event.target.value)} />
          </label>

          <div className="skills__examples">
            <span>Examples</span>
            {skill.examples.map((example) => (
              <button key={example} type="button" className="skills__example" onClick={() => setText(example)}>
                {example}
              </button>
            ))}
          </div>
        </section>
      </div>
    </Modal>
  )
}