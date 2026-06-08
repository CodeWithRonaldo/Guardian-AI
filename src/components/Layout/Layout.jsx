import { NavLink, Outlet } from 'react-router-dom';
import { ConnectButton } from '@mysten/dapp-kit';
import styles from './Layout.module.css';

const NAV_ITEMS = [
  { to: '/',             label: 'Dashboard',     icon: '◈' },
  { to: '/log',          label: 'Action Log',    icon: '≡' },
  { to: '/config',       label: 'Configuration', icon: '⚙' },
  { to: '/simulation',   label: 'Simulation',    icon: '▶' },
];

export default function Layout() {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.brandIcon}>⬡</span>
          <div>
            <div className={styles.brandName}>GuardianAI</div>
            <div className={styles.brandSub}>Sui Testnet</div>
          </div>
        </div>

        <nav className={styles.nav}>
          {NAV_ITEMS.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.active : ''}`
              }
            >
              <span className={styles.navIcon}>{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className={styles.walletArea}>
          <ConnectButton />
        </div>
      </aside>

      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
