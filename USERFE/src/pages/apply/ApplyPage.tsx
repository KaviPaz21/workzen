import { Check, FileText, Link2Off, Upload } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { WorkZenLogo } from '@/components/layout/BrandMark'
import { Button } from '@/components/ui/Button'
import { apiGet, apiPostForm } from '@/lib/api'
import { formatDate, titleCase } from '@/lib/format'
import { usePageTitle } from '@/lib/usePageTitle'
import { bucketDefinitions } from '@/modules/recruiteone/data/buckets'
import type { Buckets, Level } from '@/modules/recruiteone/types'

interface PublicVacancy {
  title: string
  closing_date: string | null
  accepting: boolean
  jd: { role: string; sector: string; level: Level; buckets: Buckets }
}

const allowed = ['.pdf', '.docx', '.txt']
const maxBytes = 10 * 1024 * 1024

const experienceOptions = ['Less than 1 year', '1-3 years', '3-5 years', '5-10 years', 'More than 10 years']
const noticeOptions = ['Immediately', 'Within 1 month', '1-2 months', 'More than 2 months']

interface FormState {
  first_name: string
  last_name: string
  email: string
  phone: string
  location: string
  profile_url: string
  current_title: string
  current_employer: string
  experience: string
  notice: string
  expected_salary: string
  cover_note: string
  consent: boolean
}

const emptyForm: FormState = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  location: '',
  profile_url: '',
  current_title: '',
  current_employer: '',
  experience: '',
  notice: '',
  expected_salary: '',
  cover_note: '',
  consent: false,
}

function Notice({ title, text }: { title: string; text: string }) {
  return (
    <div className="apply__notice">
      <span className="wizard__done-icon" aria-hidden="true">
        <Link2Off />
      </span>
      <h1>{title}</h1>
      <p className="wizard__muted">{text}</p>
    </div>
  )
}

export function ApplyPage() {
  const { token } = useParams()
  const [vacancy, setVacancy] = useState<PublicVacancy | null>(null)
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading')
  const jd = vacancy?.jd
  usePageTitle(vacancy ? `Apply: ${vacancy.title}` : 'Application')

  useEffect(() => {
    let cancelled = false
    setLoadState('loading')
    apiGet<PublicVacancy>(`/recruiteone/public/vacancies/${token}`)
      .then((found) => {
        if (cancelled) return
        setVacancy(found)
        setLoadState('ready')
      })
      .catch((error: Error) => {
        if (!cancelled) setLoadState(/not valid/i.test(error.message) ? 'missing' : 'error')
      })
    return () => {
      cancelled = true
    }
  }, [token])

  const [form, setForm] = useState<FormState>(emptyForm)
  const [file, setFile] = useState<File | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function validate() {
    const next: Record<string, string> = {}
    if (!form.first_name.trim()) next.first_name = 'Enter your first name.'
    if (!form.last_name.trim()) next.last_name = 'Enter your last name.'
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) next.email = 'Enter a valid email address.'
    if (form.phone.trim().length < 6) next.phone = 'Enter a phone number we can reach you on.'
    if (!file) next.file = 'Attach your CV.'
    else if (!allowed.some((extension) => file.name.toLowerCase().endsWith(extension))) next.file = 'Upload a PDF, DOCX or TXT file.'
    else if (file.size > maxBytes) next.file = 'The file must be 10 MB or smaller.'
    if (!form.consent) next.consent = 'Please confirm you agree before submitting.'
    return next
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length > 0 || !file || !vacancy) return
    setBusy(true)
    setSubmitError(null)
    try {
      const body = new FormData()
      body.append('file', file, file.name)
      body.append('full_name', `${form.first_name.trim()} ${form.last_name.trim()}`)
      body.append('email', form.email.trim())
      body.append('phone', form.phone.trim())
      body.append('current_title', form.current_title.trim())
      body.append(
        'application',
        JSON.stringify({
          location: form.location,
          profile_url: form.profile_url,
          current_employer: form.current_employer,
          experience: form.experience,
          notice: form.notice,
          expected_salary: form.expected_salary,
          cover_note: form.cover_note,
        }),
      )
      await apiPostForm(`/recruiteone/public/vacancies/${token}/applications`, body)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'We could not save your application. Please try again.')
      setBusy(false)
      return
    }
    setBusy(false)
    setSubmitted(true)
  }

  let content
  if (loadState === 'loading') {
    content = <p className="wizard__muted apply__loading">Loading the vacancy</p>
  } else if (loadState === 'error') {
    content = <Notice title="We could not load this vacancy" text="Please check your connection and try again in a moment." />
  } else if (!vacancy || !jd) {
    content = <Notice title="This link is not valid" text="The vacancy could not be found. Check the link or ask the recruiter for a new one." />
  } else if (!vacancy.accepting) {
    content = <Notice title="Applications are closed" text={`${vacancy.title} is no longer accepting applications.`} />
  } else if (submitted) {
    content = (
      <div className="apply__notice">
        <span className="wizard__done-icon" aria-hidden="true">
          <Check />
        </span>
        <h1>Application received</h1>
        <p className="wizard__muted">Thank you, {form.first_name}. We have your application for {vacancy.title} and will be in touch.</p>
      </div>
    )
  } else {
    content = (
      <div className="apply__grid">
        <section className="apply__jd card" aria-labelledby="apply-role">
          <div className="card__body">
            <p className="eyebrow">Open role</p>
            <h1 id="apply-role" className="apply__title">
              {vacancy.title}
            </h1>
            <div className="chip-list">
              <span className="chip">{jd.role}</span>
              <span className="chip">{jd.sector}</span>
              <span className="chip">{titleCase(jd.level)} level</span>
              {vacancy.closing_date && <span className="chip">Apply by {formatDate(vacancy.closing_date)}</span>}
            </div>
            {bucketDefinitions
              .filter(({ key }) => jd.buckets[key].length > 0)
              .map(({ key, label }) => (
                <div key={key} className="apply__bucket">
                  <h2 className="apply__bucket-title">{label}</h2>
                  <ul className="plain-list">
                    {jd.buckets[key].map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        </section>

        <form className="apply__form card" onSubmit={submit} noValidate>
          <div className="card__body">
            <h2 className="apply__form-title">Your application</h2>
            <p className="wizard__muted">Fields marked with * are required.</p>

            <fieldset className="apply__fieldset">
              <legend>About you</legend>
              <div className="apply__row">
                <Field label="First name *" error={errors.first_name}>
                  <input className="input" value={form.first_name} onChange={(event) => set('first_name', event.target.value)} aria-invalid={Boolean(errors.first_name)} autoComplete="given-name" />
                </Field>
                <Field label="Last name *" error={errors.last_name}>
                  <input className="input" value={form.last_name} onChange={(event) => set('last_name', event.target.value)} aria-invalid={Boolean(errors.last_name)} autoComplete="family-name" />
                </Field>
              </div>
              <div className="apply__row">
                <Field label="Email *" error={errors.email}>
                  <input className="input" type="email" value={form.email} onChange={(event) => set('email', event.target.value)} aria-invalid={Boolean(errors.email)} autoComplete="email" />
                </Field>
                <Field label="Phone *" error={errors.phone}>
                  <input className="input" type="tel" value={form.phone} onChange={(event) => set('phone', event.target.value)} aria-invalid={Boolean(errors.phone)} autoComplete="tel" />
                </Field>
              </div>
              <div className="apply__row">
                <Field label="City and country">
                  <input className="input" value={form.location} onChange={(event) => set('location', event.target.value)} autoComplete="address-level2" />
                </Field>
                <Field label="LinkedIn or portfolio link">
                  <input className="input" type="url" value={form.profile_url} onChange={(event) => set('profile_url', event.target.value)} placeholder="https://" />
                </Field>
              </div>
            </fieldset>

            <fieldset className="apply__fieldset">
              <legend>Experience</legend>
              <div className="apply__row">
                <Field label="Current job title">
                  <input className="input" value={form.current_title} onChange={(event) => set('current_title', event.target.value)} />
                </Field>
                <Field label="Current employer">
                  <input className="input" value={form.current_employer} onChange={(event) => set('current_employer', event.target.value)} />
                </Field>
              </div>
              <div className="apply__row">
                <Field label="Total experience">
                  <select className="select select--full" value={form.experience} onChange={(event) => set('experience', event.target.value)}>
                    <option value="">Select</option>
                    {experienceOptions.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Notice period">
                  <select className="select select--full" value={form.notice} onChange={(event) => set('notice', event.target.value)}>
                    <option value="">Select</option>
                    {noticeOptions.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Expected salary">
                <input className="input" value={form.expected_salary} onChange={(event) => set('expected_salary', event.target.value)} placeholder="Amount and currency" />
              </Field>
              <Field label="Cover note">
                <textarea className="textarea" rows={4} value={form.cover_note} onChange={(event) => set('cover_note', event.target.value)} placeholder="Tell us why you are a good fit" />
              </Field>
            </fieldset>

            <fieldset className="apply__fieldset">
              <legend>Your CV</legend>
              <label className={`drop-area${errors.file ? ' drop-area--error' : ''}`}>
                <input
                  type="file"
                  className="sr-only"
                  accept={allowed.join(',')}
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
                {file ? <FileText aria-hidden="true" /> : <Upload aria-hidden="true" />}
                <span className="cell-primary">{file ? file.name : 'Choose your CV'}</span>
                <span className="cell-secondary">PDF, DOCX or TXT, up to 10 MB</span>
              </label>
              {errors.file && (
                <p className="field__error" role="alert">
                  {errors.file}
                </p>
              )}
            </fieldset>

            <label className="apply__consent">
              <input type="checkbox" className="checkbox" checked={form.consent} onChange={(event) => set('consent', event.target.checked)} />
              <span>I agree that my details and CV can be stored and reviewed for this vacancy.</span>
            </label>
            {errors.consent && (
              <p className="field__error" role="alert">
                {errors.consent}
              </p>
            )}

            {submitError && (
              <p className="field__error" role="alert">
                {submitError}
              </p>
            )}

            <div className="apply__submit">
              <Button type="submit" disabled={busy}>
                {busy ? 'Submitting…' : 'Submit application'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="apply">
      <header className="apply__header">
        <WorkZenLogo />
        <span className="apply__header-note">Careers</span>
      </header>
      <main className="apply__main">{content}</main>
    </div>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
      {error && (
        <span className="field__error" role="alert">
          {error}
        </span>
      )}
    </label>
  )
}
