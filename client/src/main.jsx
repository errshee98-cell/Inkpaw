import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles/themes.css';
import './styles/app.css';

if (!window.crypto?.subtle) {
  document.getElementById('root').innerHTML =
    '<p style="padding:2rem;font-family:sans-serif">Inkpaw needs a secure context (HTTPS or localhost) for in-browser encryption.</p>';
} else {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
