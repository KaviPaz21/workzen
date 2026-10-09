import '@fontsource-variable/inter'
import '@fontsource-variable/source-serif-4/opsz.css'
import '@fontsource-variable/source-serif-4/opsz-italic.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { CurrentUserProvider } from '@/modules/recruiteone/state/CurrentUser'
import { AppRoutes } from '@/routes/AppRoutes'
import './styles/tokens.css'
import './styles/base.css'
import './styles/ui.css'
import './styles/layout.css'
import './styles/pages.css'
import './styles/jd.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <CurrentUserProvider>
        <AppRoutes />
      </CurrentUserProvider>
    </BrowserRouter>
  </StrictMode>,
)
