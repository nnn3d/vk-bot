import React from 'react';
import PropTypes from 'prop-types';
import Loader from 'components/utils/Loader';

import './WidgetContent.css';

const propTypes = {
    result: PropTypes.string,
    full: PropTypes.bool,
    error: PropTypes.bool,
};

const defaultProps = {
    result: '',
};

class WidgetContent extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            result: props.result,
        }
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.result)
            this.setState({
                result: nextProps.result,
            })
    }

    render() {
        let { error } = this.props;
        let result = '';
        if (this.props.result) {
        } else if (error) {
            result = 'ошибка';
        } else {
            result = (
                <Loader containerStyle={{ height: '100%' }} />
            );
        }
        return (
            <div className={'widget-content' + (this.props.full ? ' widget-content_full' : '')} tabIndex="-1">
                <div className="widget-content__info">
                    {result}
                </div>
                <div
                    className={this.props.result ? '' : 'widget-content__hidden'}
                    dangerouslySetInnerHTML={{__html: this.state.result}}
                />
            </div>
        )
    }
}

WidgetContent.propTypes = propTypes;
WidgetContent.defaultProps = defaultProps;

export default WidgetContent;