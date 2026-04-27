// App — focused on the Chips direction.
// Shows the upgraded BgChipsPro as the hero, with the original BgChips next
// to it for comparison.

const { DesignCanvas, DCSection, DCArtboard } = window;

function Frame({ Comp }) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#000' }}>
      <Comp />
      <window.LoginCard />
    </div>
  );
}

function App() {
  return (
    <DesignCanvas>
      <DCSection
        id="chips-focus"
        title="Fiches fluttuanti — iterazione"
        subtitle="Versione migliorata: prospettiva 3D reale, profondità a 3 livelli, fiches eroe in primo piano con rotazione, palette da casino reale. L'originale resta sotto per confronto."
      >
        <DCArtboard id="chips-pro" label="B2 · Fiches 3D (nuova)" width={1280} height={780}>
          <Frame Comp={window.BgChipsPro} />
        </DCArtboard>
        <DCArtboard id="chips-og" label="B · Originale (confronto)" width={1280} height={780}>
          <Frame Comp={window.BgChips} />
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
