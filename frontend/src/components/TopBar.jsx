export default function TopBar() {
  return (
    <div className="topbar" role="banner" aria-label="Emergency contacts and weather">
      <div className="container">
        <div className="emergency" aria-label="Emergency numbers">
          <span>🚨 <b>Police:</b> 100</span>
          <span className="hide-mobile">🚑 <b>Ambulance:</b> 108</span>
          <span className="hide-mobile">🔥 <b>Fire:</b> 101</span>
        </div>
        <div className="weather" aria-label="Local weather">
          <span>📍 Tirur, Kerala</span>
          <span>·</span>
          <span>31°C ☀️</span>
        </div>
      </div>
    </div>
  );
}
