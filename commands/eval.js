const path = require('path');
const fs = require('fs');
const child_process = require('child_process');
const pidusage = require('util').promisify(require('pidusage'));

const SPWN_FOLDER = path.join(process.cwd(),'SPWN');
if(!fs.existsSync(SPWN_FOLDER)) fs.mkdirSync(SPWN_FOLDER);

module.exports = {
    triggers: ['eval','e'],
    async run(bot,msg,ctx){
        if(!ctx.body) return msg.reply('No SPWN code provided');
        const code = ctx.arguments.join(' ');

        const filename = randomFileName();
        const file = path.join(SPWN_FOLDER,filename);

        try{
            await fs.promises.writeFile(file,code);
            const command = ['spwn','build',file,'-l'];

            const lang = 'rs';

            let content = `Run [${command.join(' ')}]\n`;
            let prevContent = content;

            const message = await msg.reply(await codeBlock(content,lang));

            const [cmd,...args] = command;

            const child = child_process.spawn(cmd, args, {
                stdio: 'overlapped',
            });

            const kill = async (code = 0) => {
                clearTimeout(timeout);
                clearInterval(contentInt);
                clearInterval(memoryInt);
                child.kill(0);
                child.removeAllListeners();
                deleteFile(file);
                await message.edit(await codeBlock(`${content}\nExited with code "${code}"`, lang, true));
            }

            const contentInt = setInterval(async () => {
                if(content != prevContent){
                    prevContent = content;
                    await message.edit(await codeBlock(content,lang))
                }
            }, 1250);
            const memoryInt = setInterval(async () => {
                const data = await pidusage(child.pid).catch(()=>({}));
                if(data.memory > process.env.MAX_MEMORY*(2**10)**2){
                    kill("Memory overflow");
                }
            }, 250);
            const timeout = setTimeout(() => {
                kill("Timeout");
            }, process.env.MAX_TIME*1000)

            for(const std of ['stdout','stderr'])
                child[std].on('data', res => content += `${res}`);

            child.on('close', (code) => kill(code))
        }catch(err){
            deleteFile(file);
            throw err
        }
    }
}

function deleteFile(filePath){
    if(fs.existsSync(filePath)) fs.rm(filePath,()=>{});
}

function randomFileName(){
    const BASE = 36;
    const LENGTH = 16;
    const string = () => Math.floor(Math.random()*BASE).toString(BASE);
    let file = '';
    for(let i = 0; i < LENGTH; i++) file += string();
    return file + '.spwn';
}

const codeBlock = async (string='null',language,done=false) => {
    const ansi = await import('ansi-regex');

    const MAX_LENGTH = 1800;
    const MAX_NEWLINES = 20;
    const SPLITTER = '———————————————————————————\n';
    const SLICER = '...\n';

    string = string
    .replace(ansi.default(),'')
    .replaceAll(SPWN_FOLDER,'.')

    const groups = string.split(SPLITTER);
    if(groups.length > 1){
        groups.splice(1,0,groups.splice(1,groups.length-(done ? 2 : 1)).join(SPLITTER));

        if(groups[1].length > MAX_LENGTH)
            groups[1] = groups[1].slice(0,MAX_LENGTH) + SLICER;

        const lines = groups[1].split('\n')
        if(lines.length > MAX_NEWLINES)
            groups[1] = lines.slice(0,MAX_NEWLINES).join('\n') + SLICER;
    }
    return `\`\`\`${language}\n${groups.join(SPLITTER)}\n\`\`\``;
}
