import type { ReactNode } from 'react'
import { NavLink } from 'react-router'
import styles from './BottomNav.module.css'

interface NavItem {
  to: string
  label: string
  icon: ReactNode
}

const iconProps = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

const items: NavItem[] = [
  {
    to: '/route',
    label: 'Маршрут',
    icon: (
      <svg {...iconProps}>
        <circle cx="6" cy="18" r="2" />
        <circle cx="18" cy="6" r="2" />
        <path d="M8 18h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7" />
      </svg>
    ),
  },
  {
    to: '/places',
    label: 'Еда и места',
    icon: (
      <svg {...iconProps}>
        <path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10" />
        <path d="M17 21V3c-2 1.5-3 4-3 7v3h3" />
      </svg>
    ),
  },
  {
    to: '/budget',
    label: 'Бюджет',
    icon: (
      <svg {...iconProps}>
        <rect x="3" y="6" width="18" height="13" rx="2" />
        <path d="M3 10h18M16 14.5h2" />
      </svg>
    ),
  },
  {
    to: '/favorites',
    label: 'Избранное',
    icon: (
      <svg {...iconProps}>
        <path d="M6 3h12v18l-6-4.5L6 21z" />
      </svg>
    ),
  },
]

export function BottomNav() {
  return (
    <nav className={styles.nav} aria-label="Разделы">
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              className={({ isActive }) => (isActive ? `${styles.link} ${styles.active}` : styles.link)}
            >
              {item.icon}
              <span className={styles.label}>{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
