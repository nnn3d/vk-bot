const vkIo = require('./vk')

const vk = new vkIo({
    token: '08861a4e08861a4e08861a4ee708e74d9e0088608861a4e520d9e7d68b7e0311cfc341b',
});

return vk.upload._conduct([
    {
        source: 'https://pp.userapi.com/c845323/v845323892/aaf6/Kd7LW9kKaMk.jpg'
    },
    'file',
    (p) => {
        let params = Object.assign({}, p, {image_type: '50x50'})
        return vk.api.call('appWidgets.getAppImageUploadServer', params)
    },
    vk.api.call.bind(vk.api, 'appWidgets.saveAppImage'),
    []
]).then(console.log, console.error)
