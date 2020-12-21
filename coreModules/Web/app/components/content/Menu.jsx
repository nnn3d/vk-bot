import React from 'react';
import PropTypes from 'prop-types';
import { connect, PromiseState } from 'react-refetch';
import { Collapse, Navbar, NavbarToggler, NavbarBrand, Nav, NavItem, NavLink } from 'reactstrap';
import Loader from '../utils/Loader';
import Cookies from 'js-cookie';
import { FaRefresh, FaSignOut, FaComments, FaBan } from 'react-icons/lib/fa';

import './Menu.css';

const propTypes = {
    onSelect: PropTypes.func.isRequired,
};

const defaultProps = {
    chatsFetch: { pending: true },
};

class Menu extends React.Component {
    constructor(props) {
        super(props);

        this.toggle = this.toggle.bind(this);
        this.updateChats = this.updateChats.bind(this);
        this.logOut = this.logOut.bind(this);
        this.state = {
            isOpen: true,
            selectChat: {},
        }
    }

    componentDidMount() {
        this.updateChats();
    }

    toggle() {
        this.setState({
            isOpen: !this.state.isOpen,
        });
    }

    onSelect(chat) {
        this.setState({
            selectChat: chat,
            isOpen: false,
        });
        this.props.onSelect(chat.id);
    }

    updateChats() {
        this.props.chatsUpdate((chats) => {
            if (chats.length === 1 && !this.state.selectChat.id) {
                this.onSelect(chats[0]);
            }
        });
    }

    logOut() {
        Object.keys(Cookies.getJSON()).map(name => Cookies.remove(name));
        return window && window.location && window.location.reload && window.location.reload(false);
    }

    render() {
        let { selectChat, isOpen } = this.state;
        let { chatsFetch } = this.props;

        return (
            <div>
                <Navbar color="dark" className="menu__navbar navbar-dark" expand="md">
                    <NavbarBrand className="menu__brand" onClick={this.toggle}>
                        { selectChat.title ? `${selectChat.title}` : `Чаты` }
                    </NavbarBrand>
                    <NavbarToggler onClick={this.toggle}/>
                    <Collapse isOpen={isOpen} navbar>
                        <Nav className="mr-auto" navbar>
                            {
                                chatsFetch.pending && (
                                    <NavItem>
                                        <NavLink disabled>
                                            <Loader>Загрузка чатов...</Loader>
                                        </NavLink>
                                    </NavItem>
                                ) || chatsFetch.rejected && (
                                    <NavItem>
                                        <NavLink disabled>Ошибка загрузки :(</NavLink>
                                    </NavItem>
                                ) || chatsFetch.fulfilled && (
                                    chatsFetch.value.length &&
                                    chatsFetch.value.map(chat => {
                                        let active = chat.id === selectChat.id;
                                        let chatNum = chat.id > 2e9 ? `(${chat.id-2e9})` : '';
                                        return (
                                            <NavItem key={chat.id}>
                                                <NavLink active={active} onClick={() =>this.onSelect(chat)}>
                                                    <FaComments/> {chat.title} {chatNum}
                                                </NavLink>
                                            </NavItem>
                                        );
                                    }) || (
                                        <NavItem>
                                            <NavLink disabled><FaBan/> нет доступных чатов</NavLink>
                                        </NavItem>
                                    )
                                )
                            }
                            <NavItem>
                                <NavLink
                                    disabled={chatsFetch.pending}
                                    onClick={!chatsFetch.pending && this.updateChats || (() => null)}
                                >
                                    <FaRefresh/> обновить
                                </NavLink>
                            </NavItem>
                            <NavItem>
                                <NavLink onClick={this.logOut}>
                                    <FaSignOut/> выход
                                </NavLink>
                            </NavItem>
                        </Nav>
                    </Collapse>
                </Navbar>
            </div>
        )
    }
}

Menu.propTypes = propTypes;
Menu.defaultProps = defaultProps;

export default connect(props => {
    return {
        chatsUpdate: (onResult) => ({
            chatsFetch: {
                url: '/web/chats',
                method: 'POST',
                force: true,
                then: onResult,
            }
        })
    }
})(Menu);