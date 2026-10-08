import { Link } from 'react-router-dom';

const stats = [
  { value: '250+', label: 'നാട്ടിലെ കടകൾ', detail: 'വിശ്വാസ്യതയുള്ള സ്ഥാപനങ്ങൾ' },
  { value: '40+', label: 'സേവന മേഖലകൾ', detail: 'ആരോഗ്യം, വിദ്യാഭ്യാസം, കടകൾ' },
  { value: '100+', label: 'തൊഴിലവസരങ്ങൾ', detail: 'നാട്ടിൽ തന്നെയുള്ള ജോലികൾ' },
  { value: '100%', label: 'സൗജന്യ സേവനം', detail: 'നാട്ടുകാർക്കായി എപ്പോഴും തുറന്നത്' },
];

const pillars = [
  {
    icon: '📍',
    title: 'എല്ലാം ഒരൊറ്റ ക്ലിക്കിൽ',
    description: 'കടകൾ, വർക്ക്‌ഷോപ്പുകൾ, ക്ലിനിക്കുകൾ, ടാക്സി ഡ്രൈവർമാർ എന്നിവരുടെ വിവരങ്ങൾ ഫോൺ നമ്പർ സഹിതം പെട്ടെന്ന് കണ്ടെത്താം.',
  },
  {
    icon: '🏪',
    title: 'ചെറുകിടക്കാർക്ക് വലിയ വേദി',
    description: 'ചെറിയ പെട്ടിക്കട മുതൽ വലിയ ഷോറൂമുകൾ വരെയുള്ളവർക്ക് അവരുടെ വിവരങ്ങളും ഓഫറുകളും നാട്ടുകാരിലേക്ക് സൗജന്യമായി പങ്കിടാം.',
  },
  {
    icon: '💼',
    title: 'നാട്ടിലെ ജോലികൾ',
    description: 'വിദ്യാഭ്യാസ യോഗ്യതയ്ക്കനുസരിച്ച് തിരൂരിലും സമീപപ്രദേശങ്ങളിലുമുള്ള ഒഴിവുകളിലേക്ക് നേരിട്ട് അപേക്ഷിക്കാം.',
  },
  {
    icon: '🎖️',
    title: 'ചാംബർ പിന്തുണ',
    description: 'തിരൂർ ചാംബർ ഓഫ് കൊമേഴ്സിന്റെ പിന്തുണയോടെ വ്യാപാരികൾക്ക് മാർഗ്ഗനിർദ്ദേശങ്ങളും സഹകരണവും.',
  },
];

const audiences = [
  {
    tag: 'നാട്ടുകാർക്ക്',
    title: '👨‍👩‍👧 സാധാരണ ജനങ്ങൾക്ക്',
    items: [
      'വീട്ടാവശ്യങ്ങൾക്കുള്ള പ്ലംബർ, ഇലക്ട്രീഷ്യൻ, ആശാരി എന്നിവരെ കണ്ടെത്താൻ',
      'ആശുപത്രികൾ, ആംബുലൻസ്, ഫയർഫോഴ്സ്, പോലീസ് സഹായ നമ്പറുകൾ അറിയാൻ',
      'കടകളുടെ പ്രവൃത്തി സമയം, ഓഫറുകൾ, ലൊക്കേഷൻ കണ്ടെത്താൻ',
      'എല്ലാ സേവനങ്ങളും തികച്ചും സൗജന്യമായി തിരയാൻ',
    ],
  },
  {
    tag: 'വ്യാപാരികൾക്ക്',
    title: '🏪 കടയുടമകൾക്കും സർവീസുകൾക്കും',
    items: [
      'കടയോ തൊഴിലോ പൊതു ഡയറക്ടറിയിൽ സൗജന്യമായി ലിസ്റ്റ് ചെയ്യാം',
      'ഓഫറുകളും പുതിയ ഉൽപ്പന്നങ്ങളും നാട്ടുകാരിലേക്ക് എത്തിക്കാം',
      'കൂടുതൽ ഉപഭോക്താക്കളിലേക്ക് സ്ഥാപനത്തെ പരിചയപ്പെടുത്താം',
      'അംഗത്വത്തിലൂടെ കൂടുതൽ പരസ്യ സാധ്യതകൾ നേടാം',
    ],
  },
  {
    tag: 'ഉദ്യോഗാർത്ഥികൾക്ക്',
    title: '🎓 യുവാക്കൾക്കും വിദ്യാർത്ഥികൾക്കും',
    items: [
      'തിരൂരിലെ സ്ഥാപനങ്ങളിലെ ഒഴിവുകൾ നേരിട്ട് അറിയാം',
      'സെയിൽസ്, ഓഫീസ്, കമ്പ്യൂട്ടർ, ടെക്നീഷ്യൻ ജോലികൾക്ക് അപേക്ഷിക്കാം',
      'പാർട്ട് ടൈം, ഫുൾ ടൈം തൊഴിലുകൾ വേർതിരിച്ചു കാണാം',
      'തൊഴിൽദാതാവുമായി നേരിട്ട് ബന്ധപ്പെടാം',
    ],
  },
];

export default function About() {
  return (
    <main className="about-page">
      <section className="about-hero" aria-labelledby="about-title">
        <div className="container about-hero-layout">
          <div className="about-hero-copy">
            <span className="about-kicker">🌿 നമ്മുടെ നാട് · നമ്മുടെ കൂട്ടായ്മ</span>
            <h1 id="about-title">തിരൂരിന്റെ സ്വന്തം ഡിജിറ്റൽ ഇടത്തിലേക്ക് സ്വാഗതം</h1>
            <p className="about-lead">
              തിരൂരിലെ കടകൾ, ആശുപത്രികൾ, പ്ലംബിംഗ്-ഇലക്ട്രിക്കൽ ജോലിക്കാർ, തൊഴിലവസരങ്ങൾ,
              അടിയന്തര സേവനങ്ങൾ തുടങ്ങി നിത്യജീവിതത്തിന് ആവശ്യമായതെല്ലാം വിരൽത്തുമ്പിൽ
              എത്തിക്കുന്ന ജനകീയ പ്ലാറ്റ്‌ഫോമാണ് <strong>തിരൂർ കണക്ട് (Tirur Connect)</strong>.
              നാട്ടുകാരെയും വ്യാപാരികളെയും പരസ്പരം ബന്ധിപ്പിച്ച് നമ്മുടെ നാടിനെ ഒരുമിച്ച്
              വളർത്തുകയാണ് ഞങ്ങളുടെ ലക്ഷ്യം.
            </p>
            <div className="about-hero-actions">
              <Link to="/directory" className="btn btn-primary">ഡയറക്ടറി കാണുക <span aria-hidden="true">→</span></Link>
              <Link to="/list-business" className="btn btn-outline">കടയുടെ വിവരങ്ങൾ ചേർക്കുക <span aria-hidden="true">＋</span></Link>
            </div>
          </div>
          <div className="about-hero-image">
            <img src="/images/images%20(10).jpg" alt="തിരൂർ സമൂഹത്തിലെ ആളുകൾ കൈകോർക്കുന്നു" />
            <span className="about-image-caption">നമ്മുടെ നാട് · നമ്മുടെ കൂട്ടായ്മ</span>
          </div>
        </div>
        <div className="container about-stats" aria-label="തിരൂർ കണക്ട് കണക്കുകൾ">
          {stats.map(({ value, label, detail }) => (
            <div className="about-stat" key={label}>
              <strong>{value}</strong>
              <span className="about-stat-label">{label}</span>
              <span className="about-stat-detail">{detail}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="about-story" aria-labelledby="about-story-title">
        <div className="container">
          <header className="about-section-heading">
            <span className="about-eyebrow">എന്തിനാണ് ഈ കൂട്ടായ്മ?</span>
            <h2 id="about-story-title">ഒരു നാട് ഒന്നിക്കുമ്പോൾ പുരോഗതി എളുപ്പമാകുന്നു</h2>
          </header>
          <div className="about-story-columns">
            <div>
              <p>
                നമ്മുടെ തിരൂരിൽ അത്യാവശ്യ ഘട്ടത്തിൽ ഒരു പ്ലംബറെയോ, ഇലക്ട്രീഷ്യനെയോ,
                അടുത്തുള്ള ക്ലിനിക്കിന്റെ ഫോൺ നമ്പറോ തിരഞ്ഞ് പലപ്പോഴും നമ്മൾ വിഷമിക്കാറുണ്ട്.
                മികച്ച സാധനങ്ങളും സേവനങ്ങളും നൽകുന്ന നാട്ടിലെ ചെറുകിട കച്ചവടക്കാർക്ക് അവരുടെ
                വിവരങ്ങൾ പൊതുജനങ്ങളിലേക്ക് എത്തിക്കാനും ബുദ്ധിമുട്ടായിരുന്നു.
              </p>
              <p>
                ഈ രണ്ട് ആവശ്യങ്ങളെയും ഒന്നിച്ചു ചേർത്ത് പരിഹരിക്കാനാണ് <strong>തിരൂർ കണക്ട്</strong>{' '}
                ആരംഭിച്ചത്. ഇവിടെ ഓരോരുത്തർക്കും തങ്ങൾക്ക് ആവശ്യമുള്ളത് വേഗത്തിൽ കണ്ടെത്തി
                ഇടനിലക്കാരില്ലാതെ നേരിട്ട് ബന്ധപ്പെടാം.
              </p>
            </div>
            <div>
              <p>
                ഓൺലൈൻ ഭീമന്മാരുടെ കടന്നുവരവിൽ നമ്മുടെ നാടൻ കടകളും പരമ്പരാഗത വ്യാപാരങ്ങളും
                പിന്നോട്ട് പോകരുത്. പ്രാദേശിക കച്ചവടക്കാരെ പിന്തുണയ്ക്കാനും നാട്ടിലെ യുവാക്കൾക്ക്
                തൊഴിൽ കണ്ടെത്താനും നാടിനൊപ്പം നിൽക്കുന്ന ഒരിടം വേണം.
              </p>
              <blockquote className="about-quote">
                നമ്മുടെ കടകളിൽ നിന്ന് വാങ്ങാം, നമ്മുടെ നാട്ടിലെ ആളുകൾക്ക് തൊഴിൽ നൽകാം.
                അങ്ങനെ നമ്മുടെ നാടിന്റെ സമ്പത്ത് നമ്മുടെ നാട്ടിൽ തന്നെ വളരട്ടെ.
              </blockquote>
            </div>
          </div>
        </div>
      </section>

      <section className="about-pillars" aria-labelledby="about-pillars-title">
        <div className="container">
          <header className="about-section-heading">
            <span className="about-eyebrow">ഞങ്ങളുടെ ലക്ഷ്യം</span>
            <h2 id="about-pillars-title">തിരൂർ കണക്ട് ഒരുമിച്ച് നൽകുന്നത്</h2>
          </header>
          <div className="about-pillar-grid">
            {pillars.map(({ icon, title, description }) => (
              <article className="about-pillar" key={title}>
                <span className="about-pillar-icon" aria-hidden="true">{icon}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="about-audience" aria-labelledby="about-audience-title">
        <div className="container">
          <header className="about-section-heading about-audience-heading">
            <div>
              <span className="about-eyebrow">എല്ലാവർക്കുമായി</span>
              <h2 id="about-audience-title">ആർക്കൊക്കെയാണ് തിരൂർ കണക്ട് പ്രയോജനപ്പെടുന്നത്?</h2>
            </div>
            <p>എല്ലാവർക്കുമായി തുറന്ന പ്ലാറ്റ്‌ഫോം</p>
          </header>
          <div className="about-audience-grid">
            {audiences.map(({ tag, title, items }) => (
              <article className="about-audience-card" key={tag}>
                <span className="about-audience-tag">{tag}</span>
                <h3>{title}</h3>
                <ul>
                  {items.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="about-cta" aria-labelledby="about-cta-title">
        <div className="container about-cta-inner">
          <span className="about-cta-kicker">തിരൂരിന്റെ വളർച്ചയിൽ പങ്കാളിയാകൂ</span>
          <h2 id="about-cta-title">നമ്മുടെ നാടിന്റെ വളർച്ചയിൽ നിങ്ങളും പങ്കാളിയാകൂ!</h2>
          <p>
            താങ്കളുടെ കടയോ, സേവനമോ, തൊഴിലോ ഇതുവരെ തിരൂർ കണക്ടിൽ ചേർത്തിട്ടില്ലേ?
            ഒരു രൂപ പോലും ചെലവില്ലാതെ നിങ്ങളുടെ വിവരങ്ങൾ രജിസ്റ്റർ ചെയ്യാം.
          </p>
          <div className="about-cta-actions">
            <Link to="/list-business" className="btn btn-accent">സൗജന്യമായി രജിസ്റ്റർ ചെയ്യുക <span aria-hidden="true">→</span></Link>
            <Link to="/shop-owner" className="btn about-cta-secondary">ചാംബർ അംഗത്വം <span aria-hidden="true">→</span></Link>
          </div>
        </div>
      </section>
    </main>
  );
}
