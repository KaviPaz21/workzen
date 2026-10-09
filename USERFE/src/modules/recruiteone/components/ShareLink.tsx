import { Check, Copy, ExternalLink } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { shareUrl } from '../state/RecruiteOneStore'

export function ShareLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false)
  const url = shareUrl(token)

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="share-link">
      <a href={url} target="_blank" rel="noopener noreferrer" className="share-link__url">
        {url}
        <ExternalLink aria-hidden="true" />
      </a>
      <Button size="sm" variant="secondary" icon={copied ? <Check /> : <Copy />} onClick={copy}>
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  )
}
