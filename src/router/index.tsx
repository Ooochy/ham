import { createBrowserRouter } from 'react-router-dom'
import App from '../App'
import Home from '../pages/home/Home'
import NotFound from '../pages/NotFound/NotFound'
import Ham from '../pages/ham'

export const router = createBrowserRouter([
  {
    path: '/',
    handle: { title: 'my-app' },
    element: <App />,
    children: [
      {
        path: 'ham',
        handle: { title: '业余电台操作证书考试题库' },
        element: <Ham />
      },
      {
        index: true,
        handle: { title: '首页' },
        element: <Home />
      },
      {
        path: '*',
        handle: { title: '未找到页面404' },
        element: <NotFound />
      }
    ]
  }
])
