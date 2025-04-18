import { createRoot } from 'react-dom/client';
import LoadSubtitle from './components/LoadSubtitle';
const App = () => {
    return (
        <LoadSubtitle />
    )
}

const root = createRoot(document.body);
root.render(<App />);