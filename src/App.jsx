import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import Dashboard from './pages/Dashboard/Dashboard';
import ActionLog from './pages/ActionLog/ActionLog';
import Configuration from './pages/Configuration/Configuration';
import Simulation from './pages/Simulation/Simulation';
import Docs from './pages/Docs/Docs';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index            element={<Dashboard />} />
        <Route path="log"       element={<ActionLog />} />
        <Route path="config"    element={<Configuration />} />
        <Route path="simulation" element={<Simulation />} />
        <Route path="docs"      element={<Docs />} />
      </Route>
    </Routes>
  );
}
