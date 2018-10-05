
import * as CMAB from './cmab';
import * as ZAR from './zar';
import * as ZSI from './zsi';
import * as LzS from '../compression/LzS';

import * as Viewer from '../viewer';
import * as UI from '../ui';

import ArrayBufferSlice from '../ArrayBufferSlice';
import Progressable from '../Progressable';
import { RoomRenderer } from './render';
import { SceneGroup } from '../viewer';
import { RenderState } from '../render';
import { assert, readString } from '../util';
import { fetchData, NamedArrayBufferSlice } from '../fetch';

function maybeDecompress(buffer: ArrayBufferSlice): ArrayBufferSlice {
    if (readString(buffer, 0x00, 0x04) === 'LzS\x01')
        return LzS.decompress(buffer.createDataView());
    else
        return buffer;
}

class MultiScene implements Viewer.MainScene {
    public scenes: RoomRenderer[];
    public textures: Viewer.Texture[];

    constructor(scenes: RoomRenderer[]) {
        this.scenes = scenes;
        this.textures = [];
        for (const scene of this.scenes)
            this.textures = this.textures.concat(scene.textures);
    }

    public createPanels(): UI.Panel[] {
        const layerPanel = new UI.LayerPanel();
        layerPanel.setLayers(this.scenes);
        return [layerPanel];
    }

    public render(renderState: RenderState) {
        this.scenes.forEach((scene) => {
            scene.render(renderState);
        });
    }

    public destroy(gl: WebGL2RenderingContext) {
        this.scenes.forEach((scene) => scene.destroy(gl));
    }
}

class SceneDesc implements Viewer.SceneDesc {
    public name: string;
    public id: string;

    constructor(name: string, id: string) {
        this.name = name;
        this.id = id;
    }

    public createScene(gl: WebGL2RenderingContext): Progressable<Viewer.MainScene> {
        // Fetch the GAR & ZSI.
        const path_zar = `data/mm3d/${this.id}_info.gar`;
        const path_info_zsi = `data/mm3d/${this.id}_info.zsi`;
        return Progressable.all([fetchData(path_zar), fetchData(path_info_zsi)]).then(([zar, zsi]) => {
            return this._createSceneFromData(gl, zar, zsi);
        });
    }

    private _createSceneFromData(gl: WebGL2RenderingContext, zarBuffer: NamedArrayBufferSlice, zsiBuffer: NamedArrayBufferSlice): Progressable<Viewer.MainScene> {
        const zar = ZAR.parse(maybeDecompress(zarBuffer));

        const zsi = ZSI.parse(maybeDecompress(zsiBuffer));
        assert(zsi.rooms !== null);
        const roomFilenames = zsi.rooms.map((romPath) => {
            const filename = romPath.split('/').pop();
            return `data/mm3d/${filename}`;
        });

        return Progressable.all(roomFilenames.map((filename, i) => {
            return fetchData(filename).then((roomResult) => {
                const zsi = ZSI.parse(maybeDecompress(roomResult));
                assert(zsi.mesh !== null);
                const roomRenderer = new RoomRenderer(gl, zsi, filename);
                const cmabFile = zar.files.find((file) => file.name.startsWith(`ROOM${i}`) && file.name.endsWith('.cmab'));
                if (cmabFile) {
                    const cmab = CMAB.parse(CMAB.Version.Majora, cmabFile.buffer);
                    roomRenderer.bindCMAB(cmab);
                }
                return new Progressable(Promise.resolve(roomRenderer));
            });
        })).then((scenes: RoomRenderer[]) => {
            return new MultiScene(scenes);
        });
    }
}

const id = "mm3d";
const name = "Majora's Mask 3D";
const sceneDescs: SceneDesc[] = [
    // Names graciously provided by James Knight on Twitter. Thanks!
    { id: "z2_hakugin", name: "Snowhead Temple" },
    { id: "z2_hakugin_bs", name: "Snowhead Temple (Boss)" },
    { id: "z2_miturin", name: "Woodfall Temple" },
    { id: "z2_miturin_bs", name: "Woodfall Temple (Boss)" },
    { id: "z2_sea", name: "Great Bay Temple" },
    { id: "z2_sea_bs", name: "Great Bay Temple (Boss)" },
    { id: "z2_inisie_n", name: "Stone Tower Temple" },
    { id: "z2_inisie_r", name: "Stone Tower Temple (Upside Down)" },
    { id: "z2_sougen", name: "The Moon" },
    { id: "z2_last_link", name: "The Moon - Link's Moon Trial" },
    { id: "z2_last_deku", name: "The Moon - Deku Link's Trial" },
    { id: "z2_last_goron", name: "The Moon - Goron Link's Trial" },
    { id: "z2_last_zora", name: "The Moon - Zora Link's Trial" },
    { id: "z2_last_bs", name: "Majora's Mask (Boss)" },
    { id: "z2_backtown", name: "North Clock Town" },
    { id: "z2_town", name: "East Clock Town" },
    { id: "z2_clocktower", name: "South Clock Town" },
    { id: "z2_ichiba", name: "West Clock Town" },
    { id: "z2_tenmon_dai", name: "Clock Town Sewers" },
    { id: "z2_alley", name: "Laundry Pool" },
    { id: "z2_00keikoku", name: "Termina Field" },
    { id: "z2_01keikoku", name: "Termina Field (Telescope)" },
    { id: "z2_02keikoku", name: "Termina Field (?)" },
    { id: "z2_10yukiyamanomura", name: "Mountain Village" },
    { id: "z2_10yukiyamanomura2", name: "Mountain Village (Spring)" },
    { id: "z2_11goronnosato", name: "Goron Village" },
    { id: "z2_11goronnosato2", name: "Goron Village (Spring)" },
    { id: "z2_12hakuginmae", name: "Snowhead" },
    { id: "z2_13hubukinomiti", name: "Mountain Village Trail" },
    { id: "z2_14yukidamanomiti", name: "Snowhead Trail" },
    { id: "z2_16goron_house", name: "Goron Shrine" },
    { id: "z2_17setugen", name: "Mountain Pond" },
    { id: "z2_17setugen2", name: "Mountain Pond (Spring)" },
    { id: "z2_20sichitai", name: "Southern Swamp" },
    { id: "z2_20sichitai2", name: "Southern Swamp (Clear)" },
    { id: "z2_21miturinmae", name: "Woodfall" },
    { id: "z2_22dekucity", name: "Deku Palace" },
    { id: "z2_24kemonomiti", name: "Southern Swamp Trail" },
    { id: "z2_26sarunomori", name: "Woods of Mystery" },
    { id: "z2_30gyoson", name: "Great Bay Coast" },
    { id: "z2_31misaki", name: "Zora Cape" },
    { id: "z2_33zoracity", name: "Zora Hall" },
    { id: "z2_35taki", name: "Waterfall Rapids" },
    { id: "z2_8itemshop", name: "Trading Post" },
    { id: "z2_ayashiishop", name: "Kafei's Hideout" },
    { id: "z2_bandroom", name: "Zora Band Rooms" },
    { id: "z2_bomya", name: "Bomb Shop" },
    { id: "z2_boti", name: "Ikana Graveyard" },
    { id: "z2_bowling", name: "Honey & Darling's Shop" },
    { id: "z2_castle", name: "Ancient Castle of Ikana" },
    { id: "z2_danpei", name: "Deku Shrine" },
    { id: "z2_danpei2test", name: "Ikana Grave (Night Three)" },
    { id: "z2_deku_king", name: "Deku King's Chamber" },
    { id: "z2_dekutes", name: "Deku Scrub Playground" },
    { id: "z2_doujou", name: "Swordsman's School" },
    { id: "z2_f01", name: "Romani Ranch" },
    { id: "z2_f01_b", name: "Doggy Racetrack" },
    { id: "z2_f01c", name: "Cucco Shack" },
    { id: "z2_f40", name: "Stone Tower" },
    { id: "z2_f41", name: "Stone Tower (Upside Down)" },
    { id: "z2_fisherman", name: "Fisherman's Hut" },
    { id: "z2_goron_haka", name: "Goron Graveyard" },
    { id: "z2_goronrace", name: "Goron Racetrack" },
    { id: "z2_goronshop", name: "Goron Shop" },
    { id: "z2_hakashita", name: "Ikana Grave (Night One & Two)" },
    { id: "z2_ikana", name: "Ikana Valley" },
    { id: "z2_ikanamae", name: "Ikana Trail" },
    { id: "z2_ikninside", name: "Ancient Castle of Ikana Throne Room" },
    { id: "z2_insidetower", name: "Clock Tower" },
    { id: "z2_kaizoku", name: "Pirates' Fortress (Central)" },
    { id: "z2_kajiya", name: "Mountain Smithy" },
    { id: "z2_kindan2", name: "Oceanside Spider House" },
    { id: "z2_kinsta1", name: "Swamp Spider House" },
    { id: "z2_koeponarace", name: "Gorman Track" },
    { id: "z2_konpeki_ent", name: "Great Bay Temple (Outside)" },
    { id: "z2_kyojinnoma", name: "Giant's Realm" },
    { id: "z2_labo", name: "Marine Research Lab" },
    { id: "z2_lost_woods", name: "The Lost Woods" },
    { id: "z2_map_shop", name: "Tourist Information" },
    { id: "z2_milk_bar", name: "Milk Bar" },
    { id: "z2_musichouse", name: "Music Box House" },
    { id: "z2_okujou", name: "Top of Clock Tower" },
    { id: "z2_omoya", name: "Romani's House & Barn" },
    { id: "z2_openingdan", name: "Road to Termina" },
    { id: "z2_pirate", name: "Pirates' Fortress (Inside)" },
    { id: "z2_posthouse", name: "Postman's Office" },
    { id: "z2_random", name: "Secret Shrine" },
    { id: "z2_redead", name: "Beneath the Well" },
    { id: "z2_romanymae", name: "Milk Road" },
    { id: "z2_secom", name: "Sakon's Hideout" },
    { id: "z2_sinkai", name: "Pinnacle Rock" },
    { id: "z2_sonchonoie", name: "Mayor's Office" },
    { id: "z2_syateki_mizu", name: "Town Shooting Gallery" },
    { id: "z2_syateki_mori", name: "Swamp Shooting Gallery" },
    { id: "z2_takarakuji", name: "Lottery Shop" },
    { id: "z2_takaraya", name: "Treasure Chest Minigame" },
    { id: "z2_toride", name: "Pirates' Fortress Entrance" },
    { id: "z2_tougites", name: "Poe Battle Arena" },
    { id: "z2_turobori", name: "Swamp Fishing Hole" },
    { id: "z2_turobori2", name: "Ocean Fishing Hole" },
    { id: "z2_witch_shop", name: "Magic Hags' Potion Shop" },
    { id: "z2_yadoya", name: "Stock Pot Inn" },
    { id: "z2_yousei_izumi", name: "Fairy Fountains" },
    { id: "test01", name: "Testmap 1" },
    { id: "test02", name: "Testmap 2" },
    { id: "kakusiana", name: "Underground Caves" },
    { id: "spot00" },
    { id: "z2_32kamejimamae" },
    { id: "z2_inisie_bs" },
    { id: "z2_meganeana" },
    { id: "z2_zolashop" },
].map((entry): SceneDesc => {
    const name = entry.name || entry.id;
    return new SceneDesc(name, entry.id);
});

export const sceneGroup: SceneGroup = { id, name, sceneDescs };
