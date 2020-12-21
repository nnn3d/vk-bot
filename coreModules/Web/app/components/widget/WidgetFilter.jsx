import React from 'react';
import PropTypes from 'prop-types';
import { SelectList, DropdownList, Multiselect, NumberPicker, Combobox  } from 'react-widgets';
import { FaRefresh, FaCog, FaSort } from 'react-icons/lib/fa';
import { TiTimes } from 'react-icons/lib/ti';
import { Button, ButtonGroup, Input, InputGroup } from 'reactstrap';
import  Loader from 'components/utils/Loader';

import './WidgetFilter.css';

const propTypes = {
    filter: PropTypes.object.isRequired,
    onSelect: PropTypes.func.isRequired,
    loadResult: PropTypes.func.isRequired,
    reload: PropTypes.bool,
    disable: PropTypes.bool,
    error: PropTypes.bool,
    commandProps: PropTypes.object.isRequired,
    action: PropTypes.bool.isRequired,
    changePosition: PropTypes.func,
    minimize: PropTypes.func,
    submitText: PropTypes.string,
};

const defaultProps = {

};

let messages = {
    moveBack: 'Назад',
    moveForward: 'Вперед',

    dateButton: 'Выбрать дату',
    timeButton: 'Выбрать время',

    openCombobox: 'раскрыть',
    openDropdown: 'раскрыть',

    placeholder: '',
    filterPlaceholder: '',

    emptyList: 'В списке ничего нет',
    emptyFilter: 'В фильтре ничего нет',

    createOption: function createOption(_ref) {
        let searchTerm = _ref.searchTerm;
        return [' Добавить элемент', searchTerm && ' ', searchTerm && '"' + searchTerm + '"'];
    },

    tagsLabel: 'Выбранные элементы',
    removeLabel: 'Убрать выбранный элемент',
    noneSelected: 'ничего не выбрано',
    selectedItems: function selectedItems(labels) {
        return 'Выбранные элементы: ' + labels.join(', ');
    },

    // number
    increment: 'Увеличить значение',
    decrement: 'Уменьшить значение'
};

class WidgetFilter extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        /**
         * @type {Object<String, SpecificationCommand_WebFilter>}
         */
        let filters = Object.keys(this.props.filter).map(name => {
            let filter = this.props.filter[name];
            let data = filter.data || { value: '', label: '' };
            data = Array.isArray(data) ? data : [data];
            let options = filter.options || {};
            let defaultValue = data
                .filter(el => el.default)
                .map(el => el.value);
            let value = this.props.commandProps[name];
            let inputProps = {
                value,
                onChange: ({ target: { value } })=> this.props.onSelect(name, { value }),
                disabled: this.props.disable,
                messages,
            };
            if (data.length > 15) inputProps.filter="contains";
            inputProps = Object.assign(inputProps, options);
            let numberProps = Object.assign({}, inputProps, {
                defaultValue,
                value: parseInt(value),
                onChange: value => this.props.onSelect(name, value),
            });
            let props = Object.assign({}, numberProps, {
                valueField: 'value',
                textField: 'label',
                value,
                data,
            });
            switch (filter.type) {
                case 'radio':
                    return <SelectList {...props} />;
                case 'checkbox':
                    return <SelectList {...props} multiple />;
                case 'select':
                    return <DropdownList {...props} />;
                case 'multi':
                    return <Multiselect {...props} />;
                case 'combo':
                    return <Combobox {...props} />;
                case 'number':
                    return <NumberPicker {...numberProps} />;
                case 'text':
                    return <Input type="text" {...inputProps} />;
                case 'textarea':
                    return <Input type="textarea"  {...inputProps} />;
                default:
                    return '';
            }
        });
        let action = this.props.action;
        if (this.props.reload || action) {
            let disable = this.props.disable && !this.props.error;
            let text = this.props.submitText;
            if (!text) text = action ? 'выполнить' : 'обновить';
            let icon = action ? <FaCog size="20" /> : <FaRefresh size="20" />;
            let inner = disable && action ?
                <Loader {...{icon, text}}/> :
                <span>{icon} {text}</span>;
            filters.push(
                <Button
                    block
                    outline={!action}
                    size="sm"
                    color="primary"
                    className="widget-filter__filter widget-filter__filter_refresh"
                    onClick={!disable && this.props.loadResult || (() => null)}
                    disabled={disable}
                >
                    {inner}
                </Button>
            )
        }
        filters.unshift(
            <ButtonGroup size="sm" className="widget-filter__wide-btn-group">
                <Button onClick={this.props.changePosition} color="secondary" className="widget-filter__wide-btn">
                    <FaSort/> переместить
                </Button>
                <Button onClick={this.props.minimize} color="secondary" className="widget-filter__wide-btn">
                    <TiTimes/> свернуть &nbsp;
                </Button>
            </ButtonGroup>
        );

        return (
            <div className={`widget-filter ${action ? 'widget-filter_action' : ''}`}>
                {filters.map((filter, num) => {
                    return (
                        <div key={num} className="widget-filter__filter">
                            {filter}
                        </div>
                    )
                })}
            </div>
        )
    }
}

WidgetFilter.propTypes = propTypes;
WidgetFilter.defaultProps = defaultProps;

export default WidgetFilter;
