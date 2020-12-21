import React from 'react';
import PropTypes from 'prop-types';
import WidgetContent from './WidgetContent';
import WidgetFilter from './WidgetFilter';
import { Button, Modal, ModalHeader, ModalBody, ModalFooter, Collapse } from 'reactstrap';
import { connect, PromiseState } from 'react-refetch';
import { SlideDown } from 'react-slidedown';
import Cookies from 'js-cookie';
import Alert from 'react-s-alert';
import { FaSliders } from 'react-icons/lib/fa';
import * as IconsFa from 'react-icons/lib/fa';
import * as IconsGo from 'react-icons/lib/go';
import * as IconsIo from 'react-icons/lib/io';
import * as IconsMd from 'react-icons/lib/md';
import * as IconsTi from 'react-icons/lib/ti';

let Icons = Object.assign({}, IconsFa, IconsGo, IconsIo, IconsMd, IconsTi);

import './Widget.css';

const propTypes = {
    chatId: PropTypes.number.isRequired,
    command: PropTypes.object.isRequired,
    changePosition: PropTypes.func,
    minimize: PropTypes.func,
    updateWidgets: PropTypes.func,
    minimized: PropTypes.bool,
};

const defaultProps = {

};

class Widget extends React.Component {
    constructor(props) {
        super(props);

        this.onSelect = this.onSelect.bind(this);
        this.onResult = this.onResult.bind(this);
        this.onError = this.onError.bind(this);
        this.loadResult = this.loadResult.bind(this);
        this.toggleSettings = this.toggleSettings.bind(this);
        this.toggleModal = this.toggleModal.bind(this);

        this.state = {
            result: null,
            props: this.parseCommand(props.command),
            filter: props.command.web.filter,
            command: props.command,
            load: false,
            settingsOpen: false,
            modalOpen: false,
            filterOpen: false,
        };
    }

    componentDidMount() {
        if (!this.isAction() && !this.state.result && !this.props.minimized) this.loadResult();
        this.setState({
            filterOpen: true,
        });
    }

    componentWillReceiveProps(nextProps) {
        if (this.props.command !== nextProps.command)
            this.setState({
                props: this.parseCommand(nextProps.command, this.state.props),
                filter: nextProps.command.web.filter,
                command: nextProps.command,
            }, () => {
                if (!this.isAction()) this.loadResult();
            });
    }

    isAction() {
        let command = this.state && this.state.command || this.props.command;
        return command.web.type === 'action';
    }

    isArray(type) {
        return ['checkbox', 'multi'].includes(type);
    }

    getCommandKey(command) {
        return `${this.props.chatId}${command.web.moduleName}${command.name}`;
    }

    getTitle() {
        let { command } = this.state;
        return command.web.title || command.commandList && command.commandList.name || command.name;
    }

    parseCommand(command, props) {
        let commandProps = {};
        if (!props && !this.isAction()) props = Cookies.getJSON(this.getCommandKey(command));
        Object.keys(command.web.filter).map(name => {
            let filterInfo = command.web.filter[name];
            let data = filterInfo.data || { label: '', value: '' };
            data = Array.isArray(data) ? data : [data];
            let isArray = this.isArray(filterInfo.type);
            commandProps[name] = isArray ? [] : '';
            if (filterInfo.clear) return;
            let select = data.filter(filter => filter.select);
            if (!select.length) {
                if (props && props[name]) {
                    if (isArray === Array.isArray(props[name])) commandProps[name] = props[name];
                    else if (isArray) commandProps[name] = [props[name]];
                    else commandProps[name] = props[name][0];
                } else select = data.filter(filter => filter.default);
            }
            if (select.length) {
                if (isArray) {
                    commandProps[name] = select.map(filter => filter.value);
                } else {
                    commandProps[name] = select[select.length - 1].value;
                }
            }
        });
        return commandProps;
    }

    onSelect(name, value) {
        if (Array.isArray(value)) {
            value = value.map(val => val.value);
        } else if (value instanceof Object) {
            value = value.value;
        }
        if (Array.isArray(this.state.props[name]) && Array.isArray(value)) {
            let stateValue = this.state.props[name].slice();
            stateValue.sort();
            value.sort();
            if (stateValue.toString() === value.toString()) return;
        } else if (this.state.props[name] === value) return;
        let props = Object.assign({}, this.state.props, { [name]: value });
        if (!this.isAction()) Cookies.set(this.getCommandKey(this.state.command), props);

        this.setState({ props }, () => {
            if (!this.isAction()) this.loadResult();
        });
    }

    onResult(info) {
        this.setState({
            result: info.result,
            props: this.parseCommand(info.command, this.state.props),
            filter: info.command.web.filter,
            command: info.command,
            load: false,
        }, () => {
            if (this.isAction() && this.state.result) {
                Alert.closeAll();
                Alert.info(this.state.result, {
                    position: 'top-right',
                    effect: 'stackslide',
                    beep: false,
                    timeout: 3000,
                    html: true,
                });
                let commandWeb = this.state.command.web;
                if (commandWeb.change) this.props.updateWidgets(commandWeb.change.module, commandWeb.change.command);
            }
        });
    }

    onError(info) {
        this.setState({
            load: false,
        }, () => {
            if (this.isAction()) {
                Alert.info('ошибка', {
                    position: 'top-right',
                    effect: 'stackslide',
                    beep: false,
                    timeout: 3000,
                    html: true,
                });
            }
        })
    }

    loadResult() {
        this.setState(
            {
                result: null,
                load: true,
            },
            this.props.getResult({
                chatId: this.props.chatId,
                commandName: this.state.command.name,
                moduleName: this.state.command.web.moduleName,
                props: this.state.props,
                reload: this.state.command.web.reload,
                onResult: this.onResult,
                onError: this.onError,
            })
        );
    }

    toggleSettings() {
        this.setState({
            settingsOpen: !this.state.settingsOpen,
        })
    }

    toggleModal() {
        this.setState({
            modalOpen: !this.state.modalOpen,
        })
    }

    render() {
        /**
         * @type {SpecificationCommand}
         */
        let command = this.state.command;
        let { resultFetch } = this.props;
        let title = this.getTitle();
        let type = command.web.type;
        let setOpen = this.state.settingsOpen;
        let disable = !this.state.result && (!this.isAction() || this.state.load);
        let error = false;
        let minimized = this.props.minimized;
        let icon = '';
        if (command.web.icon) {
            let Icon = command.web.icon.name && Icons[command.web.icon.name] || '';
            let iconOptions = command.web.icon.options || {};
            if (Icon)
                icon = <Icon {...iconOptions} />;
        }

        if (resultFetch && resultFetch.rejected && !this.state.load) {
            error = true;
        }
        let description = command.web.description || command.commandList && command.commandList.description || '';
        return (
            <div className="widget">
                <div className="widget__head">
                    <div
                        className={'widget__title' + (this.isAction() ? ' widget__title_full' : '')}
                        onClick={this.toggleModal}
                    >
                        {icon} {title}
                    </div>
                    {
                        !this.isAction() && !minimized && (
                            <div
                                className={`widget__settings-button ${setOpen ? 'widget__settings-button_open' : ''}`}
                                onClick={this.toggleSettings}
                            >
                                <FaSliders size="24"/>
                            </div>
                        ) || ''
                    }
                </div>
                <Collapse isOpen={(setOpen || this.isAction()) && !minimized && this.state.filterOpen} >
                    <WidgetFilter
                        filter={this.state.filter}
                        onSelect={this.onSelect}
                        minimize={this.props.minimize}
                        changePosition={this.props.changePosition}
                        reload={!command.web.disableReload}
                        loadResult={() => this.loadResult()}
                        disable={disable}
                        error={error}
                        commandProps={this.state.props}
                        action={this.isAction()}
                        submitText={command.web.submitText}
                    />
                </Collapse>
                <SlideDown className="widget__slide-down">
                    {
                        !this.isAction() && !minimized && (
                            <WidgetContent
                                result={this.state.result}
                                error={error}
                            />
                        ) || ''
                    }
                </SlideDown>
                <Modal autoFocus={false} fade={false} isOpen={this.state.modalOpen} toggle={this.toggleModal}>
                    <ModalHeader toggle={this.toggleModal}>{ this.getTitle() }</ModalHeader>
                    {
                        description && (
                            <ModalBody>
                                {description}
                            </ModalBody>
                        )
                    }
                    {
                        !this.isAction() && (
                            <ModalFooter>
                                <WidgetContent
                                    result={this.state.result}
                                    full={true}
                                    error={error}
                                />
                            </ModalFooter>
                        )
                    }
                    <ModalFooter>
                        <Button color="secondary" onClick={this.toggleModal}>закрыть</Button>
                    </ModalFooter>
                </Modal>
            </div>
        )
    }
}

Widget.propTypes = propTypes;
Widget.defaultProps = defaultProps;

export default connect(props => ({
    getResult: ({
                    chatId, commandName, moduleName, props, reload, onResult, onError, onlyCommand
                }) => {
        let resultFetch = {
            url: '/web/result',
            method: 'POST',
            body: JSON.stringify({
                chatId,
                commandName,
                moduleName,
                props,
                onlyCommand,
            }),
            then: onResult,
            catch: onError,
            force: true,
            refreshing: true,
        };
        if (reload) resultFetch.refreshInterval = reload;
        return {
            resultFetch,
        }
    }
}))(Widget);