import React      from 'react';
import ReactDOM   from 'react-dom';
import App        from './components/App.jsx';

document.addEventListener('DOMContentLoaded', () => {
    let appContainer = document.createElement('div');
    document.body.insertBefore(appContainer, document.body.firstChild);
    ReactDOM.render(<App appId={globalAppId} />, appContainer);
});