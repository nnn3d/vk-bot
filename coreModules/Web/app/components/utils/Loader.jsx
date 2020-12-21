import React from 'react';
import PropTypes from 'prop-types';
import  { FaSpinner }  from 'react-icons/lib/fa';

import './Loader.css';

const propTypes = {
    text: PropTypes.string,
    icon: PropTypes.element,
    containerStyle: PropTypes.object,
};

const defaultProps = {
    text: '',
    icon: <FaSpinner size="20"/>,
    style: {},
};

class Loader extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        let icon = this.props.icon;
        return (
            <div className="loader" style={this.props.containerStyle}>
                <div className="loader__inner">
                    <span className="loader__spinner">
                        {icon}
                    </span>
                    <span className="loader__text">
                    {this.props.children || this.props.text}
                </span>
                </div>
            </div>
        )
    }
}

Loader.propTypes = propTypes;
Loader.defaultProps = defaultProps;

export default Loader;