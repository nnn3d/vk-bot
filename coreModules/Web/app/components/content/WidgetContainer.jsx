import React from 'react';
import PropTypes from 'prop-types';
import { connect, PromiseState } from 'react-refetch';
import { Container, Row, Col, ButtonGroup, Button, Nav, NavItem, NavLink } from 'reactstrap';
import { FaEye, FaEyeSlash, FaRefresh, FaEllipsisH } from 'react-icons/lib/fa';
import { TiThSmall } from 'react-icons/lib/ti';
import Loader from 'components/utils/Loader';
import Widget from 'components/widget/Widget';
import Cookies from 'js-cookie';
import * as IconsFa from 'react-icons/lib/fa';
import * as IconsGo from 'react-icons/lib/go';
import * as IconsIo from 'react-icons/lib/io';
import * as IconsMd from 'react-icons/lib/md';
import * as IconsTi from 'react-icons/lib/ti';

let Icons = Object.assign({}, IconsFa, IconsGo, IconsIo, IconsMd, IconsTi);

import './WidgetContainer.css';

const propTypes = {
    chatId: PropTypes.any
};

const defaultProps = {

};

class WidgetContainer extends React.Component {
    constructor(props) {
        super(props);

        this.updateWidgets = this.updateWidgets.bind(this);
        this.checkVisible = this.checkVisible.bind(this);

        this.state = {
            widgets: [],
            hiddenWidgets: [],
            sections: [],
            selectSection: '',
            selectOrder: false,
            updateInfo: null,
        }
    }

    componentWillReceiveProps(nextProps) {
        if (!nextProps.commandFetch || !nextProps.commandFetch.fulfilled
            || nextProps.commandFetch.pending || nextProps.commandFetch.refreshing)
            return;
        let commands = nextProps.commandFetch.value;
        if (!this.state.updateInfo) {
            return this.setState({
                widgets: this.getOrderCommands(commands || []),
                hiddenWidgets: this.getHiddenCommands(commands || []),
                sections: this.parseSections(commands),
                selectSection: '',
                setOrder: false,
            });
        }
        let moduleExp = this.state.updateInfo.module || '.*';
        moduleExp = new RegExp(`^(${Array.isArray(moduleExp) ? moduleExp.join('|') : moduleExp})$`, 'i');
        let commandExp = this.state.updateInfo.command || '.*';
        commandExp = new RegExp(`^(${Array.isArray(commandExp) ? commandExp.join('|') : commandExp})$`, 'i');
        let widgets = this.state.widgets.slice();
        let newWidgets = nextProps.commandFetch.value;
        widgets = widgets.map(command => {
            if (moduleExp.test(command.web.moduleName) && commandExp.test(command.name)) {
                for (let newCommand of newWidgets) {
                    if (newCommand.web.moduleName === command.web.moduleName && newCommand.name === command.name) {
                        return newCommand;
                    }
                }
            }
            return command;
        });
        this.setState({
            widgets,
            sections: this.parseSections(commands),
            updateInfo: null,
        })
    }

    update() {
        this.setState({
            widgets: [],
            hiddenWidgets: [],
            sections: new Map,
            selectSection: '',
        }, this.props.update);
    }

    updateWidgets(module, command) {
        this.setState({
            updateInfo: {
                module, command
            }
        }, this.props.update)
    }

    checkVisible(command) {
        let visible = true;
        visible &= !command.web.hidden;
        visible &= this.state.selectSection ? this.state.selectSection === this.getSectionIcon(command) : true;
        return visible;
    }

    parseSections(widgets) {
        let sections = new Map;
        widgets.map(command => {
            let icon = this.getSectionIcon(command);
            let options = this.hasIcon(command) && command.web.icon.options || {};
            sections.set(icon, options);
        });
        return sections;
    }

    selectSection(icon) {
        this.setState({
            selectSection: icon,
        });
    }

    hasIcon(command) {
        return command.web.icon && command.web.icon.name && Icons[command.web.icon.name];
    }

    getIcon(command) {
        if (this.hasIcon(command)) return Icons[command.web.icon.name];
        return '';
    }

    getSectionIcon(command) {
        if (this.hasIcon(command)) return this.getIcon(command);
        return FaEllipsisH;
    }

    getOrderKey(command) {
        return `${command.web.moduleName}${command.name}`;
    }

    getOrderCookieName() {
        return `commandsOrder${this.props.chatId}`;
    }

    getOrderCommands(commands) {
        commands = commands.slice();
        let order = Cookies.getJSON(this.getOrderCookieName()) || {};
        let defaultOrder = commands.length;
        commands = commands.filter(command => {
            let o = order[this.getOrderKey(command)] || 0;
            return o >= 0;
        });
        commands.sort((a, b) => {
            let aOrder = isNaN(order[this.getOrderKey(a)])? defaultOrder : order[this.getOrderKey(a)];
            let bOrder = isNaN(order[this.getOrderKey(b)])? defaultOrder : order[this.getOrderKey(b)];
            return aOrder - bOrder;
        });
        return commands;
    }

    getHiddenCommands(commands) {
        let order = Cookies.getJSON(this.getOrderCookieName()) || {};
        return commands.filter(command => {
            let o = order[this.getOrderKey(command)] || 0;
            return o < 0;
        });
    }

    setOrderAll(widgets, hiddenWidgets) {
        let order = {};
        widgets.map((command, num) => {
            order[this.getOrderKey(command)] = num;
        });
        hiddenWidgets.map(command => {
            order[this.getOrderKey(command)] = -1;
        });
        Cookies.set(this.getOrderCookieName(), order);
        this.setState({
            widgets,
            hiddenWidgets,
            setOrder: false,
        });
    }

    selectPosition(command, num) {
        let widgets = this.state.widgets.slice();
        let hiddenWidgets = this.state.hiddenWidgets.slice();
        let oldNum = widgets.indexOf(command);
        if (oldNum === num) return this.setState({
            setOrder: false,
        });
        if (oldNum >= 0) {
            widgets.splice(oldNum, 1);
        } else {
            hiddenWidgets.splice(hiddenWidgets.indexOf(command), 1);
        }
        if (num >= 0) {
            widgets = [].concat(widgets.slice(0, num), command, widgets.slice(num));
        } else {
            hiddenWidgets.unshift(command);
        }
        this.setOrderAll(widgets, hiddenWidgets);
    }

    startChange(command) {
        this.setState({
            setOrder: command,
        });
    }

    minimize(command) {
        this.selectPosition(command, -1);
    }

    minimizeAll() {
        this.setOrderAll([], this.state.widgets.concat(this.state.hiddenWidgets));
    }

    unwrap(command) {
        this.selectPosition(command, this.state.widgets.length);
    }

    unwrapAll() {
        this.setOrderAll(this.state.widgets.concat(this.state.hiddenWidgets), []);
    }

    render() {
        let { commandFetch, getCommands, chatId } = this.props;
        if (!chatId) {
            return (
                <div className="widget-container__empty">

                </div>
            );
        } else if ((commandFetch.pending || commandFetch.refreshing) && !this.state.updateInfo) {
            return <Loader containerStyle={{ height: '250px' }} />
        } else if (commandFetch.rejected) {
            return <h3 className="widget-container__error">Ошибка загрузки :(</h3>
        } else if (commandFetch.fulfilled) {
            let setOrder = this.state.setOrder;
            let orderClass = setOrder ? 'widget-container__select' : '';
            let widgets = this.state.widgets
                .map((command, num) => {
                let onClick = setOrder ? () => this.selectPosition(setOrder, num) : () => null;
                let className = orderClass + (this.checkVisible(command) ? '' : ' d-none');
                return (
                    <Col lg="4" md="6" xs="12" key={this.getOrderKey(command)} {...{ onClick, className }}>
                        <Widget
                            chatId={chatId}
                            command={command}
                            changePosition={() => this.startChange(command)}
                            minimize={() => this.minimize(command)}
                            updateWidgets={this.updateWidgets}
                        />
                    </Col>
                )
            });
            let hiddenWidgets = this.state.hiddenWidgets
                .map(command => {
                    let className = this.checkVisible(command) ? '' : ' d-none';
                    return (
                        <Col lg="4" md="6" xs="12" key={this.getOrderKey(command)} className={className}>
                            <div onClick={() => this.unwrap(command)} className="widget-container__minimized" >
                                <Widget chatId={chatId} command={command} minimized />
                            </div>
                        </Col>
                    )
            });
            return (
                <div>
                    <div className="text-center">
                        <ButtonGroup className="widget-container__sections">
                            <Button color="primary" onClick={() => this.unwrapAll()} >
                                <FaEye/> развернуть все
                            </Button>
                            <Button color="primary" onClick={() => this.minimizeAll()} >
                                <FaEyeSlash/> свернуть все
                            </Button>
                            <Button color="primary" onClick={() => this.update()} >
                                <FaRefresh/> обновить
                            </Button>
                        </ButtonGroup>
                        <ButtonGroup className="widget-container__sections">
                            <Button
                                color="primary"
                                onClick={() => this.selectSection()}
                                active={!this.state.selectSection}
                                key="-1"
                            >
                                <TiThSmall size="24" />
                            </Button>
                            {
                                Array.from(this.state.sections.entries()).map((iconInfo, num) => {
                                    let Icon = iconInfo[0];
                                    let options = iconInfo[1];
                                    return <Button
                                        color="primary"
                                        onClick={() => this.selectSection(Icon)}
                                        active={this.state.selectSection === Icon}
                                        key={num}
                                    >
                                        <Icon {...options} size="24" />
                                    </Button>
                                })
                            }
                        </ButtonGroup>
                    </div>
                    <Container className="widget-container">
                        <Row>
                            { widgets }
                        </Row>
                        <Row>
                            { hiddenWidgets }
                        </Row>
                    </Container>
                </div>
            )
        }
        return null;
    }
}

WidgetContainer.propTypes = propTypes;
WidgetContainer.defaultProps = defaultProps;

export default connect(props => {
    if (!props.chatId) return;
    let commandFetch = {
        url: '/web/commands',
        method: 'POST',
        body: JSON.stringify({
            chatId: props.chatId,
        }),
        refreshing: true,
        force: true
    };
    return {
        commandFetch,
        update: (func) => {
            if (func) commandFetch.then = func;
            return {commandFetch};
        },
    }
})(WidgetContainer);