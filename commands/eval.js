const path = require('path');
const fs = require('fs');
const child_process = require('child_process');

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
            const command = ['spwn','b',file,'-c'];

            const lang = 'rs';

            let content = `Run [${command.map((v,i) => i == 2 ? `"${filename}"` : v).join(' ')}]\n`;
            let prevContent = content;

            const message = await msg.reply(await codeBlock(content,lang));

            const [cmd,...args] = command;

            const child = child_process.spawn(cmd, args, {
                stdio: 'overlapped',
                timeout: 1*60*1000,
            });

            const int = setInterval(async () => {
                if(content != prevContent){
                    prevContent = content;
                    await message.edit(await codeBlock(content,lang))
                }
            }, 1250);

            const stds = ['stdout','stderr'];
            for(const std of stds) child[std].on('data', res => content += res.toString());
            child.on('close', async (code) => {
                clearInterval(int);
                deleteFile(file);
                code = typeof code == 'number' ? code : '*timeout*'
                await message.edit(await codeBlock(content + `\nExited with code ${code}`, lang));
            })
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
    const string = () => Math.floor(Math.random()*BASE).toString(BASE);
    let file = '';
    for(let i = 0; i < 16; i++) file += string();
    return file + '.spwn';
}

const codeBlock = async (string='null',language='') => {
    const ansi = await import('ansi-regex');
    const MAX_LENGTH = 1900
    if(string.length > 1900) string = string.slice(0,MAX_LENGTH) + '...';
    return `\`\`\`${language||''}\n${(string||'').replace(ansi.default(),'')}\n\`\`\``;
}
