import { NavLink } from 'react-router-dom'
import styles from './TopTabs.module.css'

interface TopTabsProps {
  items: Array<{
    label: string
    to: string
  }>
}

export function TopTabs({ items }: TopTabsProps) {
  return (
    <nav className={styles.tabs} aria-label="주요 탭">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) => (isActive ? `${styles.tab} ${styles.active}` : styles.tab)}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}
