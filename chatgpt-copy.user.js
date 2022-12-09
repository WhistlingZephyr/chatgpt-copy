// ==UserScript==
// @name         ChatGPT Copy
// @namespace    https://github.com/WhistlingZephyr/chatgpt-copy
// @homepage     https://github.com/WhistlingZephyr/chatgpt-copy
// @supportURL   https://github.com/WhistlingZephyr/chatgpt-copy/issues
// @updateURL    https://raw.githubusercontent.com/WhistlingZephyr/chatgpt-copy/master/chatgpt-copy.user.js
// @downloadURL  https://raw.githubusercontent.com/WhistlingZephyr/chatgpt-copy/master/chatgpt-copy.user.js
// @version      0.1
// @description  A simple UserScript to copy ChatGPT conversations to clipboard
// @author       WhistlingZephyr
// @match        https://chat.openai.com/chat
// @icon         https://www.google.com/s2/favicons?sz=64&domain=openai.com
// @grant        GM_getValue
// @grant        GM_listValues
// @grant        GM_setValue
// @grant        GM_notification
// @grant        GM_setClipboard
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';
    const init = async () => {
        const values = await GM.listValues();
        const defaults = {
            conversationPrefix: '---',
            userPrefix: 'User: ',
            botPrefix: 'ChatGPT: ',
            messageSeperator: '\n',
            conversationSuffix: '---',
            conversation: '[]',
        };
        for (const key in defaults) {
            if (Object.hasOwnProperty.call(defaults, key)) {
                if (
                    !values.includes(key) ||
                    (await GM.getValue(key)) == undefined
                ) {
                    await GM.setValue(key, defaults[key]);
                }
            }
        }
    };
    const getMessages = async () => {
        await init();
        const userPrefix = await GM.getValue('userPrefix');
        const botPrefix = await GM.getValue('botPrefix');
        const messageSeperator = await GM.getValue('messageSeperator');
        return [...document.querySelectorAll('.whitespace-pre-wrap')].map(
            msg => {
                return msg.firstChild.tagName
                    ? botPrefix +
                          [...msg.querySelectorAll('[class^=request-] > *')]
                              .map(gptMsg => {
                                  if (gptMsg.tagName === 'PRE') {
                                      const code = gptMsg.querySelector('code');
                                      const language =
                                          [...code.classList.values()]
                                              .find(className =>
                                                  className.startsWith(
                                                      'language-'
                                                  )
                                              )
                                              ?.replace(/language-/, '') ?? '';
                                      return (
                                          '\n```' +
                                          language +
                                          '\n' +
                                          code.innerText +
                                          '```\n'
                                      );
                                  }
                                  let count = 1;
                                  return (
                                      gptMsg.innerHTML
                                          .replace(/<\/?code>/g, '`')
                                          .replace(/<\/?p>/g, '')
                                          .replace(
                                              /<li>(.+?)<\/li>/g,
                                              gptMsg.tagName == 'UL'
                                                  ? '\n- $1'
                                                  : (_match, p1) =>
                                                        `\n${count++}. ${p1}`
                                          )
                                          .trim() + '\n'
                                  );
                              })
                              .join('')
                              .trim() +
                          messageSeperator
                    : userPrefix + msg.innerText.trim() + messageSeperator;
            }
        );
    };
    const saveToStorage = async () => {
        const conversation = await getMessages();
        if (conversation.length > 0) {
            await GM.setValue(
                'conversation',
                JSON.stringify(conversation, null, 4)
            );
            return true;
        }
        return false;
    };
    const formatConversation = async conversation => {
        await init();
        const conversationPrefix = await GM.getValue('conversationPrefix');
        const conversationSuffix = await GM.getValue('conversationSuffix');
        return [
            conversationPrefix,
            conversation.join('\n').trim(),
            conversationSuffix,
        ].join('\n');
    };
    const copyToClipboard = async () => {
        await init();
        let conversation = await getMessages();
        if (conversation.length == 0) {
            conversation = JSON.parse(await GM.getValue('conversation'));
        }
        const text = await formatConversation(conversation);
        await GM.setClipboard(text);
        GM.notification(
            'Copied the last conversation to clipboard',
            'Copied successfully!'
        );
    };
    const callback = async () => {
        const saved = await saveToStorage();
        if (!saved && (await GM.getValue('conversation')) != '[]') {
            await copyToClipboard();
        }
    };

    const observer = new MutationObserver(callback);

    observer.observe(
        document.querySelector('[class^=react-scroll-to-bottom-]'),
        {
            attributes: false,
            characterData: false,
            subtree: true,
            childList: true,
        }
    );

    GM.registerMenuCommand(
        'Copy the current/last conversation to clipboard',
        async () => {
            if ((await GM.getValue('conversation')) != '[]') {
                await copyToClipboard();
            }
        },
        'c'
    );
    GM.registerMenuCommand(
        'Clear storage',
        async () => {
            await GM.setValue('conversation', '[]');
        },
        'x'
    );
    callback();
})();
