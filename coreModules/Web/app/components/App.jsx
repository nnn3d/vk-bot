import React from 'react';
import PropTypes from 'prop-types';
import Header from './layout/Header.jsx';
import Content from './layout/Content.jsx';
import Footer from './layout/Footer.jsx';
import Alert from 'react-s-alert';

import './App.css';

const propTypes = {
    appId: PropTypes.number.isRequired,
};

const defaultProps = {

};

class App extends React.Component {
    constructor(props) {
        super(props);
    }

    componentDidCatch(error, info) {
        // Display fallback UI
        // You can also log the error to an error reporting service
        console.log(error, info);
    }

    render() {
        return <div className="app">
            <Alert/>
            <Header/>
            <Content appId={this.props.appId} />
            <Footer/>
        </div>
    }
}

App.propTypes = propTypes;
App.defaultProps = defaultProps;

export default App;