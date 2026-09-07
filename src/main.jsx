import { createRoot } from 'react-dom/client'
import App from './App.jsx'

window.addEventListener('error', (e) => {
  console.error(e.error || e.message)
})

createRoot(document.getElementById('root')).render(
  <App />,
)

