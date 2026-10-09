import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { ToolCard } from '@/components/ui/ToolCard'
import { stagger } from '@/lib/stagger'
import { usePageTitle } from '@/lib/usePageTitle'
import { departments, generalTools } from '@/modules/registry'

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export function WorkZenHomePage() {
  usePageTitle('Home')

  const liveDepartments = departments.filter((department) => department.status === 'live')
  const plannedDepartments = departments.filter((department) => department.status === 'planned')

  return (
    <>


      <section className="home-hero">
        <div className="home-hero__copy">
          <p className="eyebrow reveal">{greeting()}</p>
          <h1 className="home-hero__title reveal" style={stagger(1)}>
            What are we getting done <em>today</em>?
          </h1>
          <p className="home-hero__text reveal" style={stagger(2)}>
            Pick a department tool from the menu, or start from here. Each tool uses AI to take care of the repetitive
            work.
          </p>
        </div>
      </section>

      {liveDepartments.map((department) => (
        <section key={department.id} className="home-section" aria-labelledby={`dept-${department.id}`}>
          <div className="home-section__head">
            <h2 id={`dept-${department.id}`}>
              <Link to={department.path}>{department.name}</Link>
            </h2>
            <p>{department.description}</p>
          </div>
          <div className="tool-grid">
            {department.tools.map((tool, index) => (
              <ToolCard key={tool.id} tool={tool} index={index + 3} />
            ))}
          </div>
        </section>
      ))}

      <section className="home-section" aria-labelledby="home-departments">
        <div className="home-section__head">
          <h2 id="home-departments">More departments</h2>
          <p>Each department gets its own tools in the same workspace.</p>
        </div>
        <ul className="mini-grid">
          {plannedDepartments.map(({ id, name, description, path, icon: Icon }, index) => (
            <li key={id} className="reveal" style={stagger(index + 6)}>
              <Link to={path} className="mini-card">
                <span className="mini-card__icon" aria-hidden="true">
                  <Icon />
                </span>
                <span className="mini-card__text">
                  <span className="mini-card__name">{name}</span>
                  <span className="mini-card__desc">{description}</span>
                </span>
                <Badge>Soon</Badge>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="home-section" aria-labelledby="home-general">
        <div className="home-section__head">
          <h2 id="home-general">General tools</h2>
          <p>Shared by every department.</p>
        </div>
        <ul className="mini-grid">
          {generalTools.map(({ id, name, description, path, icon: Icon }, index) => (
            <li key={id} className="reveal" style={stagger(index + 10)}>
              <Link to={path} className="mini-card">
                <span className="mini-card__icon" aria-hidden="true">
                  <Icon />
                </span>
                <span className="mini-card__text">
                  <span className="mini-card__name">{name}</span>
                  <span className="mini-card__desc">{description}</span>
                </span>
                <Badge>Soon</Badge>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
