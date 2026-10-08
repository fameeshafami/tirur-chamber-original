import TopBar from './TopBar';
import Header from './Header';
import Footer from './Footer';
import TabBar from './TabBar';

export default function Layout({ children }) {
  return (
    <>
      <TopBar />
      <Header />
      <div className="ticker-wrap" role="region" aria-label="Local notices">
        <div className="container">
          <span className="ticker-tag">NOTICE</span>
          <div className="ticker-track">
            <span className="ticker-inner">
              ⛅ Today&apos;s Weather: 31°C, Partly Cloudy — Humidity 78% &nbsp;•&nbsp;
              🚧 Road work near Tirur Junction, expect delays till 6 PM &nbsp;•&nbsp;
              🩸 Blood donation camp at Town Hall — Sunday 10 AM &nbsp;•&nbsp;
              💡 Power maintenance in Ward 4 tomorrow 10 AM–1 PM
            </span>
          </div>
        </div>
      </div>
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <Footer />
      <TabBar />
    </>
  );
}
