require('dotenv').config();
const { Client, Collection } = require('discord.js');
const filehound = require('filehound');
const { parse } = require('discord-command-parser');
const path = require('path');
const cron = require('node-cron');

const bot = new Client({
    intents: [
        'GUILDS',
        'GUILD_MESSAGES',
    ],
})

const files = filehound.create()
.path(path.join(process.cwd(),'commands'))
.ext('js')
.depth(Infinity)
.findSync();

function isTrigger(trig){
    if(Array.isArray(trig)) return trig.every(v => typeof v == 'string' && v.length > 0);
    if(typeof trig == 'string') return trig.length > 0;
    return false;
}

bot.commands = new Collection();

for(const file of files){
    try{
        const data = require(file);

        data.triggers = Array.isArray(data.triggers) ? data.triggers : [data.triggers];

        if(!isTrigger(data.triggers)) throw 'Trigger invalid';

        for(const trig of data.triggers)
            bot.commands.set(trig,data.run||(()=>{}))

    }catch(err){
        console.error(err)
    }
}

bot.on('messageCreate', async msg => {
    const res = parse(
        msg,
        process.env.PREFIX,
        {
            allowBots: false,
            allowSpaceBeforeCommand: true,
            ignorePrefixCase: true,
        }
    )

    if(!res.success) return;
    const run = bot.commands.get(res.command.toLowerCase())

    try{
        if(typeof run == 'function') {
            const val = await run(bot,msg,res);
            if(['number','string'].includes(typeof val)){
                await msg.reply(`${val}`);
            }
        }
    }catch(err){
        await msg.reply(`Error happened\n${err}`);
    }
})

function updateStatus(){
    bot.user.setPresence({
        status: 'online',
        activities: [
            {
                name: `${process.env.PREFIX}eval <spwn code>`,
                type: 'WATCHING'
            }
        ]
    })
}

bot.on('ready', () => updateStatus());
cron.schedule('0 * * * * *', () => updateStatus());

bot.login(process.env.TOKEN)
.then(() => {
    console.log("Logged in correctly!");
})
.catch(error => {
    console.error(error);
    process.exit(0);
})
