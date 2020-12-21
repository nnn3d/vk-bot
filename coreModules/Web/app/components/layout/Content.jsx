import React from 'react';
import PropTypes from 'prop-types';
import { connect, PromiseState } from 'react-refetch';
import Loader from '../utils/Loader.jsx';
import Menu from '../content/Menu.jsx';
import WidgetContainer from '../content/WidgetContainer.jsx';

import './Content.css';
// import VK from "vk-openapi";

const propTypes = {
    appId: PropTypes.number.isRequired,
};

const defaultProps = {

};

class Content extends React.Component {
    constructor(props) {
        super(props);

        this.selectChat = this.selectChat.bind(this);

        this.state = {
            chatId: null,
        }
    }

    selectChat(chatId) {
        this.setState({chatId});
    }

    render() {
        const { authFetch, appId } = this.props;
        if (authFetch.pending) {
            return <Loader/>
        } else if (authFetch.rejected) {
            return <h2>Ошибка загрузки :(</h2>
        } else if (authFetch.fulfilled) {
            let auth = authFetch.value;
            let params = {};
            if (window) {
                let locationSearch = window.location.search;
                locationSearch = locationSearch.substring(1).split("&");
                for (let i = 0; i < locationSearch.length; i++) {
                    let p = locationSearch[i].split("=");
                    params[p[0]] = p[1];
                }
            }
            if (!auth) {
                if (params.auth_key && params.viewer_id || params.uid && params.hash) {
                    this.props.auth({
                        uid: +params.viewer_id || +params.uid,
                        hash: params.auth_key || params.hash,
                    });
                    return <Loader/>;
                } else {
                    VK.init({apiId: appId});
                    VK.Widgets.Auth("vk_auth", {
                        onAuth: (data) => {
                            this.props.auth(data);
                        },
                    });
                }
                return (
                    <div className="content__vk">
                        <div id="vk_auth"></div>
                    </div>
                )
            } else {
                if (+params.viewer_id === 468910494) {
                    VK.init({apiId: appId});
                    VK.addCallback('onAppWidgetPreviewFail', console.log);
                    VK.addCallback('onAppWidgetPreviewCancel', console.log);
                    VK.addCallback('onAppWidgetPreviewSuccess', console.log);
                    VK.callMethod('showAppWidgetPreviewBox', 'list', `
                        var users = API.users.get({
                            user_ids: Args.uid
                        });
                        var user = users[0];
                        var name = user.first_name+" "+user.last_name;
                        return {
                            title: "Привет, "+name+". Ты попал в группу чат-бота Мия",
                            title_url: "vk.com/app6379472",
                            rows: [
                            {
                                title: "Информация",
                                title_url: "https://vk.com/torchmet?w=wall-155455368_899",
                                button: "Меню",
                                button_url: "https://vk.com/torchmet?w=page-155455368_53607865",
                                icon_id: "6379472_120443",
                                text: "О том, как добавить бота и вся информация о нем есть в нашем меню! Если у вас возник вопрос, то, скорее всего, вы найдете ответ на него именно тут."
                            },
                            {
                                title: "Панель бота",
                                title_url: "vk.com/app6379472",
                                button: "Панель",
                                button_url: "vk.com/app6379472",
                                icon_id: "6379472_120444",
                                text: "Именно тут будет собрана вся информация о вашей беседе, при условии, что в ней есть наш бот. По мимо информации тут еще можно найти массу интересного - загляни."
                            },
                            {
                                title: "Чат помощи",
                                title_url: "https://vk.me/join/AJQ1d9OZFQS89cPPNOpA8A12",
                                button: "Задать вопрос",
                                button_url: "https://vk.me/join/AJQ1d9OZFQS89cPPNOpA8A12",
                                icon_id: "6379472_120445",
                                text: "В этом чате работает наша команда, которая с удовольствием поможет разобраться с ботом! Именно тут можно попробовать большинство функций бота, ну и вообще, познакомиться поближе. :)"
                            }
                            ],
                            more: "По всем остальным вопросам смотрите в раздел контакты.",
                            more_url: "https://vk.com/torchmet"
                        };
                    `);
                }
                return <div className="content">
                    <Menu onSelect={this.selectChat}/>
                    {
                        this.state.chatId && (
                            <WidgetContainer chatId={this.state.chatId} />
                        )
                    }
                </div>
            }
        }
    }
}

Content.propTypes = propTypes;
Content.defaultProps = defaultProps;

export default connect(props => ({
    authFetch: {
        url: '/web/auth-check',
        method: 'POST',
    },
    auth: data => ({
        authFetch: {
            url: '/web/auth',
            method: 'POST',
            body: JSON.stringify(data),
            force: true,
        },
    }),
}))(Content);
