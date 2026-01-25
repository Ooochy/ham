import { useEffect, useState } from 'react'
import './Home.scss'

export default function Home() {
  const [isDarkMode, setIsDarkMode] = useState(false)

  useEffect(() => {
    // 从 localStorage 中读取保存的主题设置
    const savedTheme = localStorage.getItem('theme') || 'light'
    const isDark = savedTheme === 'dark'
    setIsDarkMode(isDark)
    if (isDark) {
      document.body.classList.add('dark-mode')
    }
  }, [])

  const toggleTheme = () => {
    const newIsDarkMode = !isDarkMode
    setIsDarkMode(newIsDarkMode)
    
    if (newIsDarkMode) {
      document.body.classList.add('dark-mode')
      localStorage.setItem('theme', 'dark')
    } else {
      document.body.classList.remove('dark-mode')
      localStorage.setItem('theme', 'light')
    }
  }

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault()
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }
  const toHam = () => {
    window.location.href = '/ham'
  }

  return (
    <div className="homePage">
      {/* 导航栏 */}
      <nav className="nav">
        <div className="container">
          <div className="name">崔宏宇</div>
          <div className="navRight">
            <ul>
              <li><a href="#home" onClick={(e) => scrollToSection(e, 'home')}>首页</a></li>
              <li><a href="#about" onClick={(e) => scrollToSection(e, 'about')}>关于</a></li>
              <li><a href="#contact" onClick={(e) => scrollToSection(e, 'contact')}>联系</a></li>
            </ul>
            <button className="themeToggle" onClick={toggleTheme} title="切换主题">
              {isDarkMode ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
      </nav>

      {/* 主页区域 */}
      <section id="home" className="hero">
        <div className="container">
          <div className="avatar">
            {/* 👨‍💻 */}
          </div>
          <h1>欢迎访问我的主页</h1>
          {/* <div className="title">全栈工程师 | 设计爱好者</div> */}
          <p>
            我把灵感当燃料,把bug当作彩蛋收藏。
            生活的主线任务是好奇心,支线任务是把想法做成小作品。
          </p>
          <div className="socialLinks">
            <a href="#" title="GitHub" onClick={(e) => {
              e.preventDefault();
              toHam();
            }}>
              <span>🔗</span>
            </a>
            <a href="#" title="邮件">
              <span>✉️</span>
            </a>
            <a href="#" title="LinkedIn">
              <span>💼</span>
            </a>
            <a href="#" title="Twitter">
              <span>🐦</span>
            </a>
          </div>
        </div>
      </section>

      {/* 关于区域 */}
      <section id="about" className="about">
        <div className="container">
          <h2 className="sectionTitle">关于我</h2>
          <div className="aboutContent">
            <p>
              我相信代码可以像笑话一样,简短却有梗。
              偶尔灵感爆棚,偶尔灵感卡顿,但总能恢复出厂设置。
            </p>
            <p>
              我喜欢把复杂的事说得简单,把无聊的事变得好玩。
              如果你也爱折腾,我们一定能把世界多折腾一点点。
            </p>
            <a href="#contact" className="ctaButton" onClick={(e) => scrollToSection(e, 'contact')}>立即联系我</a>
          </div>
        </div>
      </section>

      {/* 页脚 */}
      <footer id="contact" className="footer">
        <div className="container">
          <p>📧 Email: xiaocuichy@gmail.com</p>
          <p>📞 Phone: +86 123 4567 8900</p>
          <div className="footerDivider"></div>
          <div className="footerLinks">
            <a href="https://github.com/Ooochy">GitHub</a>
            <a href="#">掘金</a>
            <a href="#">知乎</a>
            <a href="#">微博</a>
          </div>
          <div className="footerDivider"></div>
          <p>&copy; 2026 cuihongyu All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
