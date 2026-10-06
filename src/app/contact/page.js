

            <div className={styles.infoCard}>
              <span className={styles.infoIcon}>📍</span>
              <div>
                <h3>Address</h3>
                <p className={styles.infoText}>
                  {SHOP_CONFIG.address}<br />
                  {SHOP_CONFIG.city}, {SHOP_CONFIG.state} - {SHOP_CONFIG.pincode}
                </p>
              </div>
            </div>

            <div className={styles.infoCard}>
              <span className={styles.infoIcon}>🕐</span>
              <div>
                <h3>Working Hours</h3>
                <p className={styles.infoText}>
                  Mon – Sat: {SHOP_CONFIG.workingHours.weekdays}<br />
                  Sunday: {SHOP_CONFIG.workingHours.sunday}
                </p>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className={styles.quickActions} style={{ flexDirection: 'column', gap: '0.75rem' }}>
              {SHOP_CONFIG.contacts.map((contact, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.75rem' }}>
                  <a href={`tel:${contact.phone}`} className="btn btn-primary btn-lg" style={{ flex: 1 }}>
                    📞 Call {contact.name.split(' ')[0]}
                  </a>
                  <a
                    href={`https://wa.me/${contact.whatsapp}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-whatsapp btn-lg"
                    style={{ flex: 1 }}
                  >
                    💬 WhatsApp {contact.name.split(' ')[0]}
                  </a>
                </div>
              ))}
            </div>
          </div>

          {/* Enquiry Form */}
          <div className={styles.formSection}>
            <h2>Send us a Message</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-6)' }}>
              Have a question? Fill out the form and we&apos;ll respond shortly.
            </p>

            <form onSubmit={handleSubmit} className={styles.form}>
              <div className="form-group">
                <label className="form-label" htmlFor="contact-name">Your Name</label>
                <input
                  id="contact-name"
                  type="text"
                  className="form-input"
                  placeholder="Enter your name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="contact-phone">Phone Number</label>
                <input
                  id="contact-phone"
                  type="tel"
                  className="form-input"
                  placeholder="Enter your phone number"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="contact-message">Message</label>
                <textarea
                  id="contact-message"
                  className="form-textarea"
                  placeholder="How can we help you?"
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  rows={5}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary btn-lg" disabled={submitting} style={{ width: '100%' }}>
                {submitting ? <><span className="spinner"></span> Sending...</> : 'Send Enquiry'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
