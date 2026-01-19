import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div>
      <h1>网站施工中</h1>
      <p>敬请期待！</p>
      <Link to="/ham">跳转到业余电台操作证书考试题库</Link>
    </div>
  )
}
