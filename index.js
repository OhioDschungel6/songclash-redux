import express, {response} from 'express';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {Server} from 'socket.io'
import {JSDOM} from 'jsdom';


//It looks like Deezer does not have any of these limitations when it comes to uses of their API on websites,
//so I may have to switch to it for the previews
//https://developers.deezer.com/guidelines

import {default as levenshtein} from 'js-levenshtein';

const app = express();
const server = createServer(app);
const io = new Server(server);
var users = new Map();
var rooms = new Set();
var gameStart = new Map();
var userRooms = new Map();
var games = {}
const __dirname = dirname(fileURLToPath(import.meta.url));


io.on('connection', (socket) => {
    console.log('a user connected ');
    socket.on('room', (data) => {
        console.log(data);
        if (!(data.room in games)) {
            users.set(socket.id, data.user);
            rooms.add(data.room);

            gameStart.set(data.room, false)
            userRooms.set(socket.id, data.room);
            socket.join(data.room);
            console.log("Room set up!");
            var lolusers = [];

            //TDOO
            for (const key of userRooms.keys()) {
                if (userRooms.get(key) == data.room) {
                    lolusers.push(users.get(key));
                }

            }
            io.to(data.room).emit("roomjoin", {roomName: bob, users: lolusers});
        }
    });

    socket.on("startGame", async (data) => {
        console.log("Hello! I would like to start a game please!")
        if (gameStart.get(data.room)) {
            return;
        }
        gameStart.set(data.room, true)

        let playlistData = await getSongs(10);

        var songs = [];
        for (var tracks of playlistData) {
            var song = {};
            song["artist"] = tracks["artist"]["name"];
            song["name"] = tracks["title_short"];
            song["audio"] = tracks["preview"];
            songs.push(song);
        }
        var scoreboard = {"rounds": {}};

        var lolusers = [];
        //TODO
        for (const key of userRooms.keys()) {
            if (userRooms.get(key) === data.room) {
                lolusers.push(users.get(key));
            }
        }
        for (var user of lolusers) {
            scoreboard[user] = 0;
        }
        for (var round = 1; round < 11; round++) {
            console.log(lolusers);
            scoreboard["rounds"][round.toString()] = {};
            for (var user of lolusers) {
                console.log(round + user);

                scoreboard["rounds"][round.toString()][user] = {
                    "artist": [],
                    "artistTrue": false,
                    "songTrue": false,
                    "song": [],
                    "first": false
                };
            }

        }
        console.log(JSON.stringify(songs));
        console.log(JSON.stringify(scoreboard));
        games[data.room] = {"round": 1, "songs": songs, "scoreboard": scoreboard, "people": lolusers};
        console.log(games);
        for (let round = 0; round < games[data.room]["songs"].length; round++) {
            console.log(round.toString());
            //Please ignore how long this line is.
            io.to(data.room).emit("roundStart", {
                room: data.room,
                round: games[data.room]["round"],
                audio: games[data.room]["songs"][round]["audio"],
                artist: games[data.room]["songs"][round]["artist"],
                song: games[data.room]["songs"][round]["name"],
                scoreboard: games[data.room]["scoreboard"]
            });

            //This timer implementation provided a way to show the time left to the players
            var timer = 29;
            for (timer; timer > 0; timer--) {
                io.to(data.room).emit("timer", {time: timer});
                await later(1000);
                var peeps = games[data.room]["people"]
                var counter = 0;
                for (var x = 0; x < peeps.length; x++) {
                    var pals = peeps[x];
                    if (games[data.room]["scoreboard"]["rounds"][games[data.room]["round"].toString()][pals]["artistTrue"] && games[data.room]["scoreboard"]["rounds"][games[data.room]["round"].toString()][pals]["songTrue"]) {
                        counter++;
                    }
                }
                if (counter === peeps.length) {
                    if (games[data.room]["round"] !== 10) {
                        break;
                    }
                }


            }
            io.to(data.room).emit("previousSong", {
                prevSong: games[data.room]["songs"][round]["name"],
                prevArtist: games[data.room]["songs"][round]["artist"]
            });
            games[data.room]["round"] = games[data.room]["round"] + 1;
        }
        games[data.room]["round"] = 10
        console.log("Welcome to the abyss of nothing...")
        await later(5000);
        var usersInRoom = [];

        for (var z = 0; z < Array.from(userRooms.values()).length; ++z) {
            if (Array.from(userRooms.values()).at(z) === data.room) {
                usersInRoom.push(Array.from(users.keys()).at(z));
            }
        }
        console.log(usersInRoom);
        for (var uzer of usersInRoom) {
            userRooms.delete(uzer);
            users.delete(uzer);

        }
        rooms.splice(rooms.indexOf(data.room));

        //Send players back to the "main" screen
        io.to(data.room).emit("reset");
        //Closes the room connection
        io.in(data.room).disconnectSockets();
        delete games[data.room];
        console.log(rooms);
        console.log(users);
        console.log(userRooms);
        console.log(JSON.stringify(games));


    });
    /*
    THIS IS THE PROCESS ANSWER AREA!!!!!

    */

    socket.on("processAnswers", async (data) => {
        //room, round, answer
        console.log(JSON.stringify(data));
        console.log(users.get(socket.id));
        console.log(JSON.stringify(games[data.room]["scoreboard"]));

        //This is a ton of stupid boilerplate but whatever
        var song = games[data.room]["songs"][games[data.room]["round"]]
        var songArtist = ["artist"].toString();
        songArtist = String(songArtist).toLowerCase();
        var songArtistWords = songArtist.split(" ");

        var titleArtist = String(song["name"]).toLowerCase()
        var titleArtistWords = titleArtist.split(" ");

        var answerWordArray = data.answer.split(" ");

        var answerArtistWords = [];
        var answerTitleWords = [];

        //Check for word similarities
        for (var answerWord of answerWordArray) {
            for (var targetWord of songArtistWords) {
                if (levenshtein(answerWord, targetWord) < 3) {
                    answerArtistWords.push(targetWord);
                }
            }
            for (var targetWords of titleArtistWords) {
                if (levenshtein(answerWord, targetWords) < 3) {
                    answerTitleWords.push(targetWords);
                }
            }
        }


        //This section of code checks the found words from the given answer, and sees if they have been found/guessed
        //already. If they have not, then they are added to the found array for both artist and song name.

        var artistScore = games[data.room]["scoreboard"]["rounds"][data.round.toString()][users.get(socket.id)]["artist"];

        for (var answerWord of answerArtistWords) {
            if (!artistScore.includes(answerWord)) {
                games[data.room]["scoreboard"]["rounds"][data.round.toString()][users.get(socket.id)]["artist"].push(answerWord);
            }
        }
        var titleScore = games[data.room]["scoreboard"]["rounds"][data.round.toString()][users.get(socket.id)]["song"];

        for (var answerWord of answerTitleWords) {
            if (!titleScore.includes(answerWord)) {
                games[data.room]["scoreboard"]["rounds"][data.round.toString()][users.get(socket.id)]["song"].push(answerWord);
            }
        }

        /*
        * This section is super easy to understand. If the found word array length is the same as the total word array length, that
        * means that every word in the answer has been found, and that boolean is flipped true and the score increases. There is
        * obviously a locking feature that prevents answers to be counted multiple times.
        */
        var artistTrue = games[data.room]["scoreboard"]["rounds"][data.round.toString()][users.get(socket.id)]["artistTrue"];
        var songTrue = games[data.room]["scoreboard"]["rounds"][data.round.toString()][users.get(socket.id)]["songTrue"];

        /*
        This checks every word in the song title or artist with all the words guessed by the player so far. This solution still
        succeeds even if the song repeats words in the artist name or song title, while simply checking array lengths against
        each other does not.
        */
        let allArtistWords = true
        for (var words of songArtistWords) {
            if (!games[data.room]["scoreboard"]["rounds"][data.round.toString()][users.get(socket.id)]["artist"].includes(words)) {
                allArtistWords = false;
            }
        }
        let allTitleWords = true
        for (var words of titleArtistWords) {
            if (!games[data.room]["scoreboard"]["rounds"][data.round.toString()][users.get(socket.id)]["song"].includes(words)) {
                allTitleWords = false;
            }
        }

        if (allArtistWords) {
            if (artistTrue == false) {
                artistTrue = true;
                games[data.room]["scoreboard"]["rounds"][data.round.toString()][users.get(socket.id)]["artistTrue"] = true;
                games[data.room]["scoreboard"][users.get(socket.id)] += 1;
            }
        }

        if (allTitleWords) {
            if (songTrue == false) {
                songTrue = true;
                games[data.room]["scoreboard"]["rounds"][data.round.toString()][users.get(socket.id)]["songTrue"] = true;
                games[data.room]["scoreboard"][users.get(socket.id)] += 1;
            }
        }

        //After the guess has been processed, the info is sent to the client to be displayed in browser.
        io.to(socket.id).emit("unveilGuess", {
            artist: songArtistWords,
            guessArtist: games[data.room]["scoreboard"]["rounds"][data.round.toString()][users.get(socket.id)]["artist"],
            title: titleArtistWords,
            guessTitle: games[data.room]["scoreboard"]["rounds"][data.round.toString()][users.get(socket.id)]["song"]
        });

        //This block just checks if a given player is the first to guess both song and artist. If they are, they get an extra point.

        if (artistTrue && songTrue) {
            if (games[data.room]["scoreboard"]["rounds"][data.round.toString()][users.get(socket.id)]["first"] == false) {
                var firstWinner = true;
                for (var userz of games[data.room]["people"]) {
                    if (userz != users.get(socket.id)) {
                        console.log(userz);
                        if (games[data.room]["scoreboard"]["rounds"][data.round.toString()][userz]["first"]) {
                            firstWinner = false;
                        }
                    }
                }
                if (firstWinner == true) {
                    console.log("wow, u the first");
                    games[data.room]["scoreboard"][users.get(socket.id)] += 1;
                    games[data.room]["scoreboard"]["rounds"][data.round.toString()][users.get(socket.id)]["first"] = true;
                }
            }

        }

        io.to(data.room).emit("scoreUpdate", {scoreboard: games[data.room]["scoreboard"]})

    });


});


// Production listening
server.listen(process.env.PORT, "0.0.0.0", () => {
    console.log('server running at ' + process.env.PORT);
});


//I found this on stackoverflow somewhere, but I don't remember when. This just returns a promise, which is funny because
//I believe async functions return promises by default, so this is a little redundant
async function later(delay) {
    return new Promise(function (resolve) {
        setTimeout(resolve, delay);
    });
}

const PLAYLIST_ID = 12296469951

async function getSongs(size) {
    const playlistLength = await getPlaylistSize();
    const songIds = new Set();
    const songs = [];
    while (songs.length < size) {
        const id = Math.floor(Math.random() * playlistLength);
        if(songIds.has(id)){
            continue;
        }
        let song = await fetchSong(id);
        if (song["preview"] === "") {
            continue;
        }
        songs.push(song);
        songIds.add(id);
        console.log(song["preview"]);
    }

    return songs;
}

async function getPlaylistSize() {
    var fetchPlalist = await fetch("https://api.deezer.com/" + PLAYLIST_ID + "/12296469951/", {
        method: 'GET',
    })
    var playlistJson = await fetchPlalist.json();
    return playlistJson["nb_tracks"];
}

//These functions are for Deezer, which does not have a limit on how their API can be used, like for a game
async function fetchSong(id) {
    var fetchSongs = await fetch("https://api.deezer.com/playlist/" + PLAYLIST_ID + "/tracks?index=" + id, {
        method: 'GET',
    })
    var songsJson = await fetchSongs.json();
    return await songsJson["data"][0];
}

