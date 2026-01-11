import { createBrowserRouter } from 'react-router-dom'
import App from '../App'
import Home from '../pages/home/Home'
import NotFound from '../pages/NotFound/NotFound'
import Ham from '../pages/ham'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      {
        path: 'ham',
        element: <Ham />
      },
      {
        index: true,
        element: <Home />
      },
      {
        path: '*',
        element: <NotFound />
      }
    ]
  }
])
