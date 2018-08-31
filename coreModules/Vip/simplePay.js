const crypto = require('crypto');

module.exports = {
    md5 (data) {
        return crypto.createHash('md5')
            .update(data)
            .digest('hex');
    },
    // Функция для сортировки объектов по ключам в алфавитном порядке
    sortObject(obj) {
        let sorted = {},
            key, a = [];

        for (key in obj) {
            if (obj.hasOwnProperty(key)) { a.push(key); }
        }

        a.sort();

        for (key = 0; key < a.length; key++) {
            sorted[a[key]] = obj[a[key]];
        }
        return sorted;
    },

    // Функция для формирования строки конкатенации
    makeConcatString(/* Объект с параметрами */ params, /* Имя скрипта */ script_name, /* Секретный ключ */ secret_key){

        // удаляем параметр с подписью - если есть
        delete params['sp_sig'];

        // генерируем только если ее не было передано в params (например при проверке на result)
        if(params['sp_salt'] === undefined){
            params['sp_salt'] = parseInt(Math.random()*10000000);
        }
        // инициализируем для конкатенации
        let concat_str = '';

        // сортируем параметры по ключам в алфавитном порядке
        let sorted_json = this.sortObject(params);

        // собираем строку для конкатенации
        for (let key in sorted_json) {
            if (sorted_json.hasOwnProperty(key)) {
                concat_str = concat_str + sorted_json[key]+';';
            }
        }

        // добавляем в строку имя скрипта и секретный ключ
        concat_str = script_name+';'+concat_str+secret_key;

        return concat_str;
    },

    // Создание конечной хеш-подписи
    makeSignatureString(/* Объект с параметрами */ params, /* Имя скрипта */ script_name, /* Секретный ключ */ secret_key){
        return this.md5(this.makeConcatString(params, script_name, secret_key));
    },

    // Создание GET-запроса к API
    makePaymentRequest( /* Объект с параметрами */ params, /* URL на который направляется запрос */ url, /* Секретный ключ */ secret_key){
        let script_name_parts = url.split('/');
        let script_name = script_name_parts[script_name_parts.length-1];

        let signature = this.makeSignatureString(params, script_name, secret_key);

        // создаем массив с конечными параметрами
        let full_params = params;
        full_params['sp_sig'] = signature;

        // формируем query string
        let query_string = require('querystring').stringify(full_params);

        // возвращаем полный URL
        return url+'?'+query_string;

    }
};
