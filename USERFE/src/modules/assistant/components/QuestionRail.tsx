import { useEffect, useState, type RefObject } from 'react'
import type { ChatMessage } from '../types'

interface QuestionRailProps {
  messages: ChatMessage[]
  scrollerRef: RefObject<HTMLDivElement | null>
}

interface Tip {
  number: number
  text: string
  top: number
  right: number
}

const topOffset = 96
const bottomTolerance = 24

function shorten(text: string) {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length > 90 ? `${clean.slice(0, 89)}…` : clean
}

export function QuestionRail({ messages, scrollerRef }: QuestionRailProps) {
  const questions = messages.filter((message) => message.role === 'user')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [tip, setTip] = useState<Tip | null>(null)

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    function locate() {
      const area = scrollerRef.current
      if (!area) return
      const areaTop = area.getBoundingClientRect().top
      const elements = Array.from(area.querySelectorAll<HTMLElement>('[data-question-id]'))
      const atBottom = area.scrollHeight - area.scrollTop - area.clientHeight < bottomTolerance
      let current: string | null = elements[0]?.dataset.questionId ?? null
      if (atBottom && area.scrollTop > 0) {
        current = elements[elements.length - 1]?.dataset.questionId ?? current
      } else {
        for (const element of elements) {
          if (element.getBoundingClientRect().top - areaTop <= topOffset) current = element.dataset.questionId ?? current
        }
      }
      setActiveId(current)
    }
    locate()
    scroller.addEventListener('scroll', locate, { passive: true })
    window.addEventListener('resize', locate)
    return () => {
      scroller.removeEventListener('scroll', locate)
      window.removeEventListener('resize', locate)
    }
  }, [scrollerRef, messages])

  if (questions.length === 0) return null

  function jump(id: string) {
    const target = scrollerRef.current?.querySelector<HTMLElement>(`[data-question-id="${id}"]`)
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const activeIndex = questions.findIndex((question) => question.id === activeId)

  function showTip(target: HTMLElement, number: number, text: string) {
    const box = target.getBoundingClientRect()
    setTip({ number, text: shorten(text), top: box.top + box.height / 2, right: window.innerWidth - box.left + 10 })
  }

  return (
    <nav className="rail" aria-label="Your questions in this chat">
      <ol className="rail__list" onScroll={() => setTip(null)}>
        {questions.map((question, index) => (
          <li key={question.id}>
            <button
              type="button"
              className="rail__dot"
              data-distance={activeIndex < 0 ? 3 : Math.min(Math.abs(index - activeIndex), 3)}
              aria-label={`Question ${index + 1}: ${shorten(question.content)}`}
              aria-current={question.id === activeId ? 'true' : undefined}
              onClick={() => jump(question.id)}
              onMouseEnter={(event) => showTip(event.currentTarget, index + 1, question.content)}
              onMouseLeave={() => setTip(null)}
              onFocus={(event) => showTip(event.currentTarget, index + 1, question.content)}
              onBlur={() => setTip(null)}
            />
          </li>
        ))}
      </ol>
      {tip && (
        <span className="rail__tip" role="tooltip" style={{ top: tip.top, right: tip.right }}>
          <span className="rail__tip-number">{tip.number}</span>
          {tip.text}
        </span>
      )}
    </nav>
  )
}

