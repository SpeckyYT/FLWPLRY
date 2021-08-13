module.exports = {
    triggers: ['help','h'],
    run: (bot,msg,ctx) =>
        `Available command triggers: ${[...bot.commands.keys()].map(r => `\`${r}\``).join(' ')}`
}
