import Link from 'next/link';
import { SHOP_CONFIG } from '@/lib/constants';
import styles from './Footer.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`${styles.content} container`}>
        <div className={styles.grid}>
          {/* Brand */}
          <div className={styles.brand}>
            <span className={styles.logo}>⚙️ {SHOP_CONFIG.name}</span>
            <p className={styles.desc}>{SHOP_CONFIG.description}</p>
          </div>

          {/* Quick Links */}
          <div className={styles.column}>
            <h4 className={styles.columnTitle}>Quick Links</h4>
            <Link href="/parts" className={styles.link}>Browse Parts</Link>
            <Link href="/request-part" className={styles.link}>Request a Part</Link>
            <Link href="/contact" className={styles.link}>Contact Us</Link>
          </div>

          {/* Categories */}
          <div className={styles.column}>
            <h4 className={styles.columnTitle}>Categories</h4>
            <Link href="/parts?category=Engine+Parts" className={styles.link}>Engine Parts</Link>
            <Link href="/parts?category=Brakes" className={styles.link}>Brakes</Link>
            <Link href="/parts?category=Electrical" className={styles.link}>Electrical</Link>
            <Link href="/parts?category=Body+Parts" className={styles.link}>Body Parts</Link>
          </div>

          {/* Contact */}
          <div className={styles.column}>
            <h4 className={styles.columnTitle}>Contact</h4>
            {SHOP_CONFIG.contacts.map((contact, i) => (
              <div key={i}>
                <span className={styles.link} style={{ fontSize: '0.8rem', opacity: 0.7 }}>{contact.name}</span>
                <a href={`tel:${contact.phone}`} className={styles.link}>
                  📞 {contact.phone.replace(/^\+91(\d{5})(\d{5})$/, '+91 $1 $2')}
                </a>
                <a
                  href={`https://wa.me/${contact.whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.link}
                >
                  💬 WhatsApp
                </a>
              </div>
            ))}
            <span className={styles.link}>📍 {SHOP_CONFIG.address}</span>
          </div>
        </div>

        <div className={styles.bottom}>
          <p>© {new Date().getFullYear()} {SHOP_CONFIG.name}. All rights reserved.</p>
          <p className={styles.hours}>
            Mon-Sat: {SHOP_CONFIG.workingHours.weekdays} | Sun: {SHOP_CONFIG.workingHours.sunday}
          </p>
        </div>
      </div>
    </footer>
  );
}
