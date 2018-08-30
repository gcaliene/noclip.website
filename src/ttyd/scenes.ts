
import * as Viewer from '../viewer';
import Progressable from '../Progressable';
import { fetch } from '../util';

import * as TPL from './tpl';
import * as World from './world';
import { WorldRenderer, TPLTextureHolder } from './render';

class TTYDSceneDesc implements Viewer.SceneDesc {
    constructor(public id: string, public name: string = id) {
    }

    public createScene(gl: WebGL2RenderingContext): Progressable<Viewer.Scene> {
        const pathBase = `data/ttyd/${this.id}`;
        return Progressable.all([fetch(`${pathBase}/d.blob`), fetch(`${pathBase}/t.blob`)]).then(([dBuffer, tBuffer]) => {
            const d = World.parse(dBuffer);
            const textureHolder = new TPLTextureHolder();
            const tpl = TPL.parse(tBuffer, d.textureNameTable);
            textureHolder.addTPLTextures(gl, tpl);
            return new WorldRenderer(gl, d, textureHolder);
        });
    }
}

// Room names compiled by Ralf@gc-forever.
// http://www.gc-forever.com/forums/viewtopic.php?p=30808#p30808

const sceneDescs: Viewer.SceneDesc[] = [
    new TTYDSceneDesc('aaa_00', "Mario's House"),
    new TTYDSceneDesc('aji_00', "X-Naut Fortress: Entrance"),
    new TTYDSceneDesc('aji_01', "X-Naut Fortress: Elevator Corridor"),
    new TTYDSceneDesc('aji_02', "X-Naut Fortress: Electric Tile Room (Lvl 1)"),
    new TTYDSceneDesc('aji_03', "X-Naut Fortress: Storage Room"),
    new TTYDSceneDesc('aji_04', "X-Naut Fortress: Thwomp Statue Room"),
    new TTYDSceneDesc('aji_05', "X-Naut Fortress: Electric Tile Room (Lvl 2)"),
    new TTYDSceneDesc('aji_06', "X-Naut Fortress: Grodus's Lab"),
    new TTYDSceneDesc('aji_07', "X-Naut Fortress: Teleporter Room"),
    new TTYDSceneDesc('aji_08', "X-Naut Fortress: Genetic Lab"),
    new TTYDSceneDesc('aji_09', "X-Naut Fortress: Changing Room"),
    new TTYDSceneDesc('aji_10', "X-Naut Fortress: Control Room"),
    new TTYDSceneDesc('aji_11', "X-Naut Fortress: Office"),
    new TTYDSceneDesc('aji_12', "X-Naut Fortress: Electric Tile Room (Lvl 3)"),
    new TTYDSceneDesc('aji_13', "X-Naut Fortress: Factory"),
    new TTYDSceneDesc('aji_14', "X-Naut Fortress: Magnus Von Grapple's Room"),
    new TTYDSceneDesc('aji_15', "X-Naut Fortress: Shower Room"),
    new TTYDSceneDesc('aji_16', "X-Naut Fortress: Locker Room"),
    new TTYDSceneDesc('aji_17', "X-Naut Fortress: Computer Room"),
    new TTYDSceneDesc('aji_18', "X-Naut Fortress: Card Key Room"),
    new TTYDSceneDesc('aji_19', "X-Naut Fortress: Conveyor Belt"),
    new TTYDSceneDesc('bom_00', "Fahr Outpost: Pipe Entrance"),
    new TTYDSceneDesc('bom_01', "Fahr Outpost: West Side"),
    new TTYDSceneDesc('bom_02', "Fahr Outpost: East Side"),
    new TTYDSceneDesc('bom_03', "Fahr Outpost: Field #1"),
    new TTYDSceneDesc('bom_04', "Fahr Outpost: Field #2"),
    new TTYDSceneDesc('dou_00', "Pirate's Grotto: Entrance"),
    new TTYDSceneDesc('dou_01', "Pirate's Grotto: Springboard Room"),
    new TTYDSceneDesc('dou_02', "Pirate's Grotto: Spike Trap Room #1"),
    new TTYDSceneDesc('dou_03', "Pirate's Grotto: Sluice Gate Room"),
    new TTYDSceneDesc('dou_04', "Pirate's Grotto: Black Key Room"),
    new TTYDSceneDesc('dou_05', "Pirate's Grotto: Save Block Room"),
    new TTYDSceneDesc('dou_06', "Pirate's Grotto: Parabuzzy Room"),
    new TTYDSceneDesc('dou_07', "Pirate's Grotto: Black Chest Room"),
    new TTYDSceneDesc('dou_08', "Pirate's Grotto: Sunken Ship"),
    new TTYDSceneDesc('dou_09', "Pirate's Grotto: Platform Room"),
    new TTYDSceneDesc('dou_10', "Pirate's Grotto: Spike Trap Room #2"),
    new TTYDSceneDesc('dou_11', "Pirate's Grotto: Exit"),
    new TTYDSceneDesc('dou_12', "Pirate's Grotto: Bill Blaster Bridge"),
    new TTYDSceneDesc('dou_13', "Pirate's Grotto: Long Corridor"),
    new TTYDSceneDesc('eki_00', "Riverside Station: Entrance"),
    new TTYDSceneDesc('eki_01', "Riverside Station: Wooden Gates Room"),
    new TTYDSceneDesc('eki_02', "Riverside Station: Big Clock Room"),
    new TTYDSceneDesc('eki_03', "Riverside Station: Outer Stairs"),
    new TTYDSceneDesc('eki_04', "Riverside Station: Garbage Dump"),
    new TTYDSceneDesc('eki_05', "Riverside Station: Office"),
    new TTYDSceneDesc('eki_06', "Riverside Station: Records Room"),
    new TTYDSceneDesc('end_00', "Ending Credits"),
    new TTYDSceneDesc('gon_00', "Hooktail Castle: Entrance"),
    new TTYDSceneDesc('gon_01', "Hooktail Castle: Garden"),
    new TTYDSceneDesc('gon_02', "Hooktail Castle: Corridor"),
    new TTYDSceneDesc('gon_03', "Hooktail Castle: Red Bones' Room"),
    new TTYDSceneDesc('gon_04', "Hooktail Castle: Great Hall"),
    new TTYDSceneDesc('gon_05', "Hooktail Castle: Save Block Room"),
    new TTYDSceneDesc('gon_06', "Hooktail Castle: Black Chest Room"),
    new TTYDSceneDesc('gon_07', "Hooktail Castle: Spike Trap Room"),
    new TTYDSceneDesc('gon_08', "Hooktail Castle: Green Block Room"),
    new TTYDSceneDesc('gon_09', "Hooktail Castle: Yellow Block Room"),
    new TTYDSceneDesc('gon_10', "Hooktail Castle: Tower"),
    new TTYDSceneDesc('gon_11', "Hooktail Castle: Hooktail's Lair"),
    new TTYDSceneDesc('gon_12', "Hooktail Castle: Treasure Room"),
    new TTYDSceneDesc('gon_13', "Hooktail Castle: Hidden Room"),
    new TTYDSceneDesc('gor_00', "Rogueport: Harbor"),
    new TTYDSceneDesc('gor_01', "Rogueport: Main Square"),
    new TTYDSceneDesc('gor_02', "Rogueport: East Side"),
    new TTYDSceneDesc('gor_03', "Rogueport: West Side"),
    new TTYDSceneDesc('gor_04', "Rogueport: Station"),
    new TTYDSceneDesc('gor_10', "Rogueport: Arrival (Cutscene)"),
    new TTYDSceneDesc('gor_11', "Rogueport: Outside (Dusk)"),
    new TTYDSceneDesc('gor_12', "Rogueport: Outside (Dawn)"),
    new TTYDSceneDesc('gra_00', "Twilight Trail: Shed Area"),
    new TTYDSceneDesc('gra_01', "Twilight Trail: Long Path"),
    new TTYDSceneDesc('gra_02', "Twilight Trail: Fallen Tree Area"),
    new TTYDSceneDesc('gra_03', "Twilight Trail: Twilight Woods"),
    new TTYDSceneDesc('gra_04', "Twilight Trail: Huge Tree Area"),
    new TTYDSceneDesc('gra_05', "Twilight Trail: Boulder Area"),
    new TTYDSceneDesc('gra_06', "Creepy Steeple: Outside"),
    new TTYDSceneDesc('hei_00', "Petal Meadows: Pipe To Hooktail Castle"),
    new TTYDSceneDesc('hei_01', "Petal Meadows: River Bridge"),
    new TTYDSceneDesc('hei_02', "Petal Meadows: Path To Shhwonk Fortress #1"),
    new TTYDSceneDesc('hei_03', "Petal Meadows: Pedestal Room #1"),
    new TTYDSceneDesc('hei_04', "Petal Meadows: Path To Shhwonk Fortress #2"),
    new TTYDSceneDesc('hei_05', "Petal Meadows: Pedestal Room #2"),
    new TTYDSceneDesc('hei_06', "Petal Meadows: Path To Shhwonk Fortress #3"),
    new TTYDSceneDesc('hei_07', "Shhwonk Fortress: Entrance"),
    new TTYDSceneDesc('hei_08', "Shhwonk Fortress: Moon Stone Room"),
    new TTYDSceneDesc('hei_09', "Shhwonk Fortress: Western Room"),
    new TTYDSceneDesc('hei_10', "Shhwonk Fortress: Red Block Room"),
    new TTYDSceneDesc('hei_11', "Shhwonk Fortress: Eastern Room"),
    new TTYDSceneDesc('hei_12', "Shhwonk Fortress: Sun Stone Room"),
    new TTYDSceneDesc('hei_13', "Petal Meadows: Long Pipe Area"),
    new TTYDSceneDesc('hom_00', "Riverside Station: Outside"),
    new TTYDSceneDesc('hom_10', "Excess Express: To Poshley Heights #1"),
    new TTYDSceneDesc('hom_11', "Excess Express: To Riverside Station"),
    new TTYDSceneDesc('hom_12', "Excess Express: To Poshley Heights #2"),
    new TTYDSceneDesc('jin_00', "Creepy Steeple: Entrance"),
    new TTYDSceneDesc('jin_01', "Creepy Steeple: Northern Courtyard"),
    new TTYDSceneDesc('jin_02', "Creepy Steeple: Southern Courtyard"),
    new TTYDSceneDesc('jin_03', "Creepy Steeple: Staircase Room"),
    new TTYDSceneDesc('jin_04', "Creepy Steeple: Belfry"),
    new TTYDSceneDesc('jin_05', "Creepy Steeple: Storage Room"),
    new TTYDSceneDesc('jin_06', "Creepy Steeple: Hidden Room"),
    new TTYDSceneDesc('jin_07', "Creepy Steeple: Underground Corridor"),
    new TTYDSceneDesc('jin_08', "Creepy Steeple: Underground Room"),
    new TTYDSceneDesc('jin_09', "Creepy Steeple: Well's Bottom"),
    new TTYDSceneDesc('jin_10', "Creepy Steeple: Buzzy Beetles Room"),
    new TTYDSceneDesc('jin_11', "Creepy Steeple: Door-Shaped Object Room"),
    new TTYDSceneDesc('jon_00', "Pit Of 100 Trials: Regular Floor #1"),
    new TTYDSceneDesc('jon_01', "Pit Of 100 Trials: Regular Floor #2"),
    new TTYDSceneDesc('jon_02', "Pit Of 100 Trials: Regular Floor #3"),
    new TTYDSceneDesc('jon_03', "Pit Of 100 Trials: Intermediate Floor #1"),
    new TTYDSceneDesc('jon_04', "Pit Of 100 Trials: Intermediate Floor #2"),
    new TTYDSceneDesc('jon_05', "Pit Of 100 Trials: Intermediate Floor #3"),
    new TTYDSceneDesc('jon_06', "Pit Of 100 Trials: Lowest Floor"),
    new TTYDSceneDesc('kpa_00', "Bowser's Castle: Outside"),
    new TTYDSceneDesc('kpa_01', "Bowser's Castle: Hall"),
    new TTYDSceneDesc('kpa_02', "Super Koopa Bros.: World 1"),
    new TTYDSceneDesc('kpa_03', "Super Koopa Bros.: World 2 (Part 1)"),
    new TTYDSceneDesc('kpa_04', "Super Koopa Bros.: World 2 (Part 2)"),
    new TTYDSceneDesc('kpa_05', "Super Koopa Bros.: World 3 (Part 1)"),
    new TTYDSceneDesc('kpa_06', "Super Koopa Bros.: World 3 (Part 2)"),
    new TTYDSceneDesc('kpa_07', "Bowser's Castle: Mini-Gym"),
    new TTYDSceneDesc('las_00', "Palace Of Shadow: Entrance"),
    new TTYDSceneDesc('las_01', "Palace Of Shadow: Long Stairway"),
    new TTYDSceneDesc('las_02', "Palace Of Shadow: Long Corridor"),
    new TTYDSceneDesc('las_03', "Palace Of Shadow: Spike Trap Room"),
    new TTYDSceneDesc('las_04', "Palace Of Shadow: Large Bridge Room"),
    new TTYDSceneDesc('las_05', "Palace Of Shadow: Humongous Room"),
    new TTYDSceneDesc('las_06', "Palace Of Shadow: Long Hall"),
    new TTYDSceneDesc('las_07', "Palace Of Shadow: Red & Yellow Blocks Room"),
    new TTYDSceneDesc('las_08', "Palace Of Shadow: Staircase Room"),
    new TTYDSceneDesc('las_09', "Palace Of Shadow: Palace Garden"),
    new TTYDSceneDesc('las_10', "Palace Of Shadow: Tower Entrance"),
    new TTYDSceneDesc('las_11', "Palace Of Shadow: Riddle Room #1"),
    new TTYDSceneDesc('las_12', "Palace Of Shadow: Riddle Room #2"),
    new TTYDSceneDesc('las_13', "Palace Of Shadow: Riddle Room #3"),
    new TTYDSceneDesc('las_14', "Palace Of Shadow: Riddle Room #4"),
    new TTYDSceneDesc('las_15', "Palace Of Shadow: Riddle Room #5"),
    new TTYDSceneDesc('las_16', "Palace Of Shadow: Riddle Room #6"),
    new TTYDSceneDesc('las_17', "Palace Of Shadow: Riddle Room #7"),
    new TTYDSceneDesc('las_18', "Palace Of Shadow: Riddle Room #8"),
    new TTYDSceneDesc('las_19', "Palace Of Shadow: Corridor #1"),
    new TTYDSceneDesc('las_20', "Palace Of Shadow: Seven Stars Room (Part 1)"),
    new TTYDSceneDesc('las_21', "Palace Of Shadow: Corridor #2"),
    new TTYDSceneDesc('las_22', "Palace Of Shadow: Seven Stars Room (Part 2)"),
    new TTYDSceneDesc('las_23', "Palace Of Shadow: Corridor #3"),
    new TTYDSceneDesc('las_24', "Palace Of Shadow: Seven Stars Room (Part 3)"),
    new TTYDSceneDesc('las_25', "Palace Of Shadow: Corridor #4"),
    new TTYDSceneDesc('las_26', "Palace Of Shadow: Gloomtail's Room"),
    new TTYDSceneDesc('las_27', "Palace Of Shadow: Weird Room"),
    new TTYDSceneDesc('las_28', "Palace Of Shadow: Main Hall"),
    new TTYDSceneDesc('las_29', "Palace Of Shadow: Deepest Room"),
    new TTYDSceneDesc('las_30', "Palace Of Shadow: Long Staircase Room"),
    new TTYDSceneDesc('moo_00', "Moon: Save Block Area"),
    new TTYDSceneDesc('moo_01', "Moon: Area #1"),
    new TTYDSceneDesc('moo_02', "Moon: Pipe To X-Naut Fortress"),
    new TTYDSceneDesc('moo_03', "Moon: Teleporter Cutscene #1"),
    new TTYDSceneDesc('moo_04', "Moon: Teleporter Cutscene #2"),
    new TTYDSceneDesc('moo_05', "Moon: Area #2"),
    new TTYDSceneDesc('moo_06', "Moon: Area #3"),
    new TTYDSceneDesc('moo_07', "Moon: Area #4"),
    new TTYDSceneDesc('mri_00', "The Great Tree: Base Of The Tree"),
    new TTYDSceneDesc('mri_01', "The Great Tree: Entrance"),
    new TTYDSceneDesc('mri_02', "The Great Tree: Punies Switch Room"),
    new TTYDSceneDesc('mri_03', "The Great Tree: Red & Blue Cell Room"),
    new TTYDSceneDesc('mri_04', "The Great Tree: Storage Room"),
    new TTYDSceneDesc('mri_05', "The Great Tree: Bubble Room"),
    new TTYDSceneDesc('mri_06', "The Great Tree: Red Block Room"),
    new TTYDSceneDesc('mri_07', "The Great Tree: Hidden Shop"),
    new TTYDSceneDesc('mri_08', "The Great Tree: Punies vs. 10 Jabbies"),
    new TTYDSceneDesc('mri_09', "The Great Tree: Blue Key Room"),
    new TTYDSceneDesc('mri_10', "The Great Tree: Big Treasure Chest Room"),
    new TTYDSceneDesc('mri_11', "The Great Tree: Punies vs. 100 Jabbies"),
    new TTYDSceneDesc('mri_12', "The Great Tree: Big Pedestal Room"),
    new TTYDSceneDesc('mri_13', "The Great Tree: 101 Punies Switch Room"),
    new TTYDSceneDesc('mri_14', "The Great Tree: Lowest Chamber"),
    new TTYDSceneDesc('mri_15', "The Great Tree: Control Panel Room"),
    new TTYDSceneDesc('mri_16', "The Great Tree: Water Room"),
    new TTYDSceneDesc('mri_17', "The Great Tree: Cage Room"),
    new TTYDSceneDesc('mri_18', "The Great Tree: Passageway Room #1"),
    new TTYDSceneDesc('mri_19', "The Great Tree: Plane Tile Room"),
    new TTYDSceneDesc('mri_20', "The Great Tree: Passageway Room #2"),
    new TTYDSceneDesc('muj_00', "Keelhaul Key: Entrance"),
    new TTYDSceneDesc('muj_01', "Keelhaul Key: Shantytown"),
    new TTYDSceneDesc('muj_02', "Keelhaul Key: Jungle Path"),
    new TTYDSceneDesc('muj_03', "Keelhaul Key: Cliff Area"),
    new TTYDSceneDesc('muj_04', "Keelhaul Key: Rope Bridge"),
    new TTYDSceneDesc('muj_05', "Keelhaul Key: Mustache Statues"),
    new TTYDSceneDesc('muj_10', "Pirate's Grotto: Deepest Part"),
    new TTYDSceneDesc('muj_11', "Cortez's Ship: Entrance"),
    new TTYDSceneDesc('muj_12', "Cortez's Ship: Captain's Cabin"),
    new TTYDSceneDesc('muj_20', "Cortez's Ship: Outside (Cutscene)"),
    new TTYDSceneDesc('muj_21', "Rogueport: Mario & Peach (Cutscene)"),
    new TTYDSceneDesc('nok_00', "Petalburg: West Side"),
    new TTYDSceneDesc('nok_01', "Petalburg: East Side"),
    new TTYDSceneDesc('pik_00', "Poshley Heights: Station"),
    new TTYDSceneDesc('pik_01', "Poshley Sanctum: Outside"),
    new TTYDSceneDesc('pik_02', "Poshley Sanctum: Fake Garnet Star Room"),
    new TTYDSceneDesc('pik_03', "Poshley Sanctum: Real Garnet Star Room"),
    new TTYDSceneDesc('pik_04', "Poshley Heights: Main Square"),
    new TTYDSceneDesc('rsh_00_a', "Excess Express: Right Engineer's Car (Day)"),
    new TTYDSceneDesc('rsh_00_b', "Excess Express: Right Engineer's Car (Dusk)"),
    new TTYDSceneDesc('rsh_00_c', "Excess Express: Right Engineer's Car (Night)"),
    new TTYDSceneDesc('rsh_01_a', "Excess Express: Cabins #1-2 (Day)"),
    new TTYDSceneDesc('rsh_01_b', "Excess Express: Cabins #1-2 (Dusk)"),
    new TTYDSceneDesc('rsh_01_c', "Excess Express: Cabins #1-2 (Night)"),
    new TTYDSceneDesc('rsh_02_a', "Excess Express: Cabins #3-5 (Day)"),
    new TTYDSceneDesc('rsh_02_b', "Excess Express: Cabins #3-5 (Dusk)"),
    new TTYDSceneDesc('rsh_02_c', "Excess Express: Cabins #3-5 (Night)"),
    new TTYDSceneDesc('rsh_03_a', "Excess Express: Dining Car (Day)"),
    new TTYDSceneDesc('rsh_03_b', "Excess Express: Dining Car (Dusk)"),
    new TTYDSceneDesc('rsh_03_c', "Excess Express: Dining Car (Night)"),
    new TTYDSceneDesc('rsh_04_a', "Excess Express: Cabins #6-8 (Day)"),
    new TTYDSceneDesc('rsh_04_b', "Excess Express: Cabins #6-8 (Dusk)"),
    new TTYDSceneDesc('rsh_04_c', "Excess Express: Cabins #6-8 (Night)"),
    new TTYDSceneDesc('rsh_05_a', "Excess Express: Left Freight Car"),
    new TTYDSceneDesc('rsh_06_a', "Excess Express: Train's Roof"),
    new TTYDSceneDesc('rsh_07_a', "Excess Express: Left Engineer's Car (Day)"),
    new TTYDSceneDesc('rsh_07_b', "Excess Express: Left Engineer's Car (Dusk)"),
    new TTYDSceneDesc('rsh_07_c', "Excess Express: Left Engineer's Car (Night)"),
    new TTYDSceneDesc('rsh_08_a', "Excess Express: Right Freight Car"),
    new TTYDSceneDesc('sys_00', "Game Over Screen"),
    new TTYDSceneDesc('sys_01', "Prologue Screen"),
    new TTYDSceneDesc('tik_00', "Rogueport Sewers: Underground Shop Area"),
    new TTYDSceneDesc('tik_01', "Rogueport Sewers: East Side Entrance"),
    new TTYDSceneDesc('tik_02', "Rogueport Sewers: Pipe To Petal Meadows"),
    new TTYDSceneDesc('tik_03', "Rogueport Sewers: Pipe To Boggly Woods"),
    new TTYDSceneDesc('tik_04', "Rogueport Sewers: Staircase Room"),
    new TTYDSceneDesc('tik_05', "Rogueport Sewers: Thousand-Year Door Room"),
    new TTYDSceneDesc('tik_06', "Rogueport Sewers: Entrance To The Pit Of 100 Trials"),
    new TTYDSceneDesc('tik_07', "Rogueport Sewers: West Side Entrance"),
    new TTYDSceneDesc('tik_08', "Rogueport Sewers: Pipe To Twilight Town"),
    new TTYDSceneDesc('tik_11', "Rogueport Sewers: Chet Rippo's House"),
    new TTYDSceneDesc('tik_12', "Rogueport Sewers: Merlee The Charmer's House"),
    new TTYDSceneDesc('tik_13', "Rogueport Sewers: Storage Room"),
    new TTYDSceneDesc('tik_15', "Rogueport Sewers: Garden-Variety Corridor"),
    new TTYDSceneDesc('tik_16', "Rogueport Sewers: Underground Corridor #1"),
    new TTYDSceneDesc('tik_17', "Rogueport Sewers: Underground Corridor #2"),
    new TTYDSceneDesc('tik_18', "Rogueport Sewers: Underground Corridor #3"),
    new TTYDSceneDesc('tik_19', "Rogueport Sewers: Black Chest Room"),
    new TTYDSceneDesc('tik_20', "Rogueport Sewers: Undiscovered Chamber"),
    new TTYDSceneDesc('tik_21', "Rogueport Sewers: Spike Trap Room"),
    new TTYDSceneDesc('tou_00', "Glitzville: Arrival (Cutscene)"),
    new TTYDSceneDesc('tou_01', "Glitzville: Main Square"),
    new TTYDSceneDesc('tou_02', "Glitzville: Glitz Pit Lobby"),
    new TTYDSceneDesc('tou_03', "Glitzville: Glitz Pit"),
    new TTYDSceneDesc('tou_04', "Glitzville: Backstage Corridor"),
    new TTYDSceneDesc('tou_05', "Glitzville: Promoter's Room"),
    new TTYDSceneDesc('tou_06', "Glitzville: Glitz Pit Storage Room"),
    new TTYDSceneDesc('tou_07', "Glitzville: Champ's Room"),
    new TTYDSceneDesc('tou_08', "Glitzville: Major-League Locker Room"),
    new TTYDSceneDesc('tou_09', "Glitzville: Major-League Locker Room (Locked)"),
    new TTYDSceneDesc('tou_10', "Glitzville: Minor-League Locker Room"),
    new TTYDSceneDesc('tou_11', "Glitzville: Minor-League Locker Room (Locked)"),
    new TTYDSceneDesc('tou_12', "Glitzville: Glitz Pit Top Floor Storage Room"),
    new TTYDSceneDesc('tou_13', "Glitzville: Ventilation Duct"),
    new TTYDSceneDesc('tou_20', "Glitzville: Cheep Blimp (Cutscene)"),
    new TTYDSceneDesc('usu_00', "Twilight Town: West Side"),
    new TTYDSceneDesc('usu_01', "Twilight Town: East Side"),
    new TTYDSceneDesc('win_00', "Boggly Woods: Western Field"),
    new TTYDSceneDesc('win_01', "Boggly Woods: Pipe To The Great Tree"),
    new TTYDSceneDesc('win_02', "Boggly Woods: Eastern Field"),
    new TTYDSceneDesc('win_03', "Boggly Woods: Pipe To Flurrie's House"),
    new TTYDSceneDesc('win_04', "Flurrie's House: Entrance"),
    new TTYDSceneDesc('win_05', "Flurrie's House: Bedroom"),
    new TTYDSceneDesc('win_06', "Boggly Woods: Pipe Entrance"),
    new TTYDSceneDesc('yuu_00', "Pianta Parlor: Plane Game"),
    new TTYDSceneDesc('yuu_01', "Pianta Parlor: Boat Game"),
    new TTYDSceneDesc('yuu_02', "Pianta Parlor: Tube Game"),
    new TTYDSceneDesc('yuu_03', "Pianta Parlor: Paper Game"),

    new TTYDSceneDesc('stg_01', "Battle Stage - Red"),
    new TTYDSceneDesc('stg_02', "Battle Stage - Green"),
    new TTYDSceneDesc('stg_03', "Battle Stage - Blue"),
    new TTYDSceneDesc('stg_04', "Battle Stage - White"),

    new TTYDSceneDesc('stg_00_0'),
    new TTYDSceneDesc('stg_00_1'),
    new TTYDSceneDesc('stg_00_2'),
    new TTYDSceneDesc('stg_00_3'),
    new TTYDSceneDesc('stg_00_4'),
    new TTYDSceneDesc('stg_01_0'),
    new TTYDSceneDesc('stg_01_1'),
    new TTYDSceneDesc('stg_01_2'),
    new TTYDSceneDesc('stg_01_3'),
    new TTYDSceneDesc('stg_01_4'),
    new TTYDSceneDesc('stg_01_5'),
    new TTYDSceneDesc('stg_01_6'),
    new TTYDSceneDesc('stg_02_0'),
    new TTYDSceneDesc('stg_02_1'),
    new TTYDSceneDesc('stg_03_0'),
    new TTYDSceneDesc('stg_04_0'),
    new TTYDSceneDesc('stg_04_1'),
    new TTYDSceneDesc('stg_04_2'),
    new TTYDSceneDesc('stg_04_3'),
    new TTYDSceneDesc('stg_04_4'),
    new TTYDSceneDesc('stg_04_5'),
    new TTYDSceneDesc('stg_04_6'),
    new TTYDSceneDesc('stg_05_0'),
    new TTYDSceneDesc('stg_05_1'),
    new TTYDSceneDesc('stg_05_2'),
    new TTYDSceneDesc('stg_05_3'),
    new TTYDSceneDesc('stg_05_4'),
    new TTYDSceneDesc('stg_05_5'),
    new TTYDSceneDesc('stg_06_0'),
    new TTYDSceneDesc('stg_06_1'),
    new TTYDSceneDesc('stg_06_2'),
    new TTYDSceneDesc('stg_06_3'),
    new TTYDSceneDesc('stg_06_4'),
    new TTYDSceneDesc('stg_07_0'),
    new TTYDSceneDesc('stg_07_1'),
    new TTYDSceneDesc('stg_07_2'),
    new TTYDSceneDesc('stg_07_3'),
    new TTYDSceneDesc('stg_07_4'),
    new TTYDSceneDesc('stg_07_5'),
    new TTYDSceneDesc('stg_07_6'),
    new TTYDSceneDesc('stg_08_0'),
    new TTYDSceneDesc('stg_08_1'),
    new TTYDSceneDesc('stg_08_2'),
    new TTYDSceneDesc('stg_08_3'),
    new TTYDSceneDesc('stg_08_4'),
    new TTYDSceneDesc('stg_08_5'),
    new TTYDSceneDesc('stg_08_6'),
    new TTYDSceneDesc('stg01_1'),
    new TTYDSceneDesc('rsh_05_b'),
    new TTYDSceneDesc('rsh_05_c'),
    new TTYDSceneDesc('rsh_06_b'),
    new TTYDSceneDesc('rsh_06_c'),
];

const id = 'ttyd';
const name = 'Paper Mario: The Thousand Year Door';
export const sceneGroup: Viewer.SceneGroup = { id, name, sceneDescs };
