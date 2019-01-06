
// Mario Kart Wii

import * as Viewer from '../viewer';
import * as BRRES from './brres';
import * as U8 from './u8';
import * as Yaz0 from '../compression/Yaz0';

import { assert } from '../util';
import { fetchData } from '../fetch';
import Progressable from '../Progressable';
import ArrayBufferSlice from '../ArrayBufferSlice';
import { mat4 } from 'gl-matrix';
import { RRESTextureHolder, MDL0Model, MDL0ModelInstance } from './render';
import AnimationController from '../AnimationController';
import { GXRenderHelperGfx } from '../gx/gx_render';
import { GfxDevice, GfxHostAccessPass, GfxRenderPass } from '../gfx/platform/GfxPlatform';
import { GfxRenderInstViewRenderer } from '../gfx/render/GfxRenderer';
import { BasicRenderTarget, depthClearRenderPassDescriptor, standardFullClearRenderPassDescriptor } from '../gfx/helpers/RenderTargetHelpers';

const enum MKWiiPass { MAIN = 0x01, SKYBOX = 0x02 }

class MarioKartWiiRenderer implements Viewer.Scene_Device {
    public viewRenderer = new GfxRenderInstViewRenderer();
    public renderTarget = new BasicRenderTarget();

    public textureHolder: RRESTextureHolder = new RRESTextureHolder();
    public renderHelper: GXRenderHelperGfx;
    private animationController: AnimationController;

    private skyboxRenderer: MDL0ModelInstance;
    private courseRenderer: MDL0ModelInstance;

    constructor(device: GfxDevice, public courseRRES: BRRES.RRES, public skyboxRRES: BRRES.RRES) {
        this.renderHelper = new GXRenderHelperGfx(device);
        this.animationController = new AnimationController();

        this.textureHolder.addRRESTextures(device, skyboxRRES);
        this.textureHolder.addRRESTextures(device, courseRRES);

        assert(skyboxRRES.mdl0.length === 1);
        const skyboxModel = new MDL0Model(device, this.renderHelper, skyboxRRES.mdl0[0]);
        this.skyboxRenderer = new MDL0ModelInstance(device, this.renderHelper, this.textureHolder, skyboxModel, 'vrbox');
        this.skyboxRenderer.isSkybox = true;
        this.skyboxRenderer.passMask = MKWiiPass.SKYBOX;

        assert(courseRRES.mdl0.length === 1);
        const courseModel = new MDL0Model(device, this.renderHelper, courseRRES.mdl0[0]);
        this.courseRenderer = new MDL0ModelInstance(device, this.renderHelper, this.textureHolder, courseModel, 'course');
        this.courseRenderer.passMask = MKWiiPass.MAIN;

        // Mario Kart Wii courses appear to be very, very big. Scale them down a bit.
        const scaleFactor = 0.1;
        mat4.fromScaling(this.courseRenderer.modelMatrix, [scaleFactor, scaleFactor, scaleFactor]);
        mat4.fromScaling(this.skyboxRenderer.modelMatrix, [scaleFactor, scaleFactor, scaleFactor]);

        // Bind animations.
        this.skyboxRenderer.bindRRESAnimations(this.animationController, skyboxRRES);
        this.courseRenderer.bindRRESAnimations(this.animationController, courseRRES);

        this.renderHelper.finishBuilder(device, this.viewRenderer);
    }

    protected prepareToRender(hostAccessPass: GfxHostAccessPass, viewerInput: Viewer.ViewerRenderInput): void {
        this.renderHelper.fillSceneParams(viewerInput);
        this.skyboxRenderer.prepareToRender(this.renderHelper, viewerInput);
        this.courseRenderer.prepareToRender(this.renderHelper, viewerInput);
        this.renderHelper.prepareToRender(hostAccessPass);
    }

    public render(device: GfxDevice, viewerInput: Viewer.ViewerRenderInput): GfxRenderPass {
        this.animationController.updateTime(viewerInput.time);

        const hostAccessPass = device.createHostAccessPass();
        this.prepareToRender(hostAccessPass, viewerInput);
        device.submitPass(hostAccessPass);

        this.renderTarget.setParameters(device, viewerInput.viewportWidth, viewerInput.viewportHeight);
        this.viewRenderer.setViewport(viewerInput.viewportWidth, viewerInput.viewportHeight);
        // First, render the skybox.
        const skyboxPassRenderer = device.createRenderPass(this.renderTarget.gfxRenderTarget, standardFullClearRenderPassDescriptor);
        this.viewRenderer.executeOnPass(device, skyboxPassRenderer, MKWiiPass.SKYBOX);
        skyboxPassRenderer.endPass(null);
        device.submitPass(skyboxPassRenderer);
        // Now do main pass.
        const mainPassRenderer = device.createRenderPass(this.renderTarget.gfxRenderTarget, depthClearRenderPassDescriptor);
        this.viewRenderer.executeOnPass(device, mainPassRenderer, MKWiiPass.MAIN);
        return mainPassRenderer;
    }

    public destroy(device: GfxDevice): void {
        this.textureHolder.destroyGfx(device);
        this.viewRenderer.destroy(device);
        this.renderTarget.destroy(device);

        this.courseRenderer.destroy(device);
        this.skyboxRenderer.destroy(device);
    }
}

class MarioKartWiiSceneDesc implements Viewer.SceneDesc {
    constructor(public id: string, public name: string) {}

    public createScene_Device(device: GfxDevice): Progressable<Viewer.Scene_Device> {
        return fetchData(`data/mkwii/${this.id}.szs`).then((buffer: ArrayBufferSlice) => {
            return Yaz0.decompress(buffer);
        }).then((buffer: ArrayBufferSlice): Viewer.Scene_Device => {
            const arch = U8.parse(buffer);
            const courseRRES = BRRES.parse(arch.findFile('./course_model.brres').buffer);
            const skyboxRRES = BRRES.parse(arch.findFile('./vrcorn_model.brres').buffer);
            return new MarioKartWiiRenderer(device, courseRRES, skyboxRRES);
        });
    }
}

const id = 'mkwii';
const name = 'Mario Kart Wii';
// Courses named and organized by Starschulz
const sceneDescs = [
    "Mushroom Cup",
    new MarioKartWiiSceneDesc('beginner_course', "Luigi Circuit"),
    new MarioKartWiiSceneDesc('farm_course', "Moo Moo Meadows"),
    new MarioKartWiiSceneDesc('kinoko_course', "Mushroom Gorge"),
    new MarioKartWiiSceneDesc('factory_course', "Toad's Factory"),
    "Flower Cup",
    new MarioKartWiiSceneDesc('castle_course', "Mario Circuit"),
    new MarioKartWiiSceneDesc('shopping_course', "Coconut Mall"),
    new MarioKartWiiSceneDesc('boardcross_course', "DK Summit"),
    new MarioKartWiiSceneDesc('truck_course', "Wario's Gold Mine"),
    "Star Cup",
    new MarioKartWiiSceneDesc('senior_course', "Daisy Circuit"),
    new MarioKartWiiSceneDesc('water_course', "Koopa Cape"),
    new MarioKartWiiSceneDesc('treehouse_course', "Maple Treeway"),
    new MarioKartWiiSceneDesc('volcano_course', "Grumble Volcano"),
    "Special Cup",
    new MarioKartWiiSceneDesc('desert_course', "Dry Dry Ruins"),
    new MarioKartWiiSceneDesc('ridgehighway_course', "Moonview Highway"),
    new MarioKartWiiSceneDesc('koopa_course', "Bowser's Castle"),
    new MarioKartWiiSceneDesc('rainbow_course', "Rainbow Road"),
    "Shell Cup",
    new MarioKartWiiSceneDesc('old_peach_gc', "GCN Peach Beach"),
    new MarioKartWiiSceneDesc('old_falls_ds', "DS Yoshi Falls"),
    new MarioKartWiiSceneDesc('old_obake_sfc', "SNES Ghost Valley 2"),
    new MarioKartWiiSceneDesc('old_mario_64', "N64 Mario Raceway"),
    "Banana Cup",
    new MarioKartWiiSceneDesc('old_sherbet_64', "N64 Sherbet Land"),
    new MarioKartWiiSceneDesc('old_heyho_gba', "GBA Shy Guy Beach"),
    new MarioKartWiiSceneDesc('old_town_ds', "DS Delfino Square"),
    new MarioKartWiiSceneDesc('old_waluigi_gc', "GCN Waluigi Stadium"),
    "Leaf Cup",
    new MarioKartWiiSceneDesc('old_desert_ds', "DS Desert Hills"),
    new MarioKartWiiSceneDesc('old_koopa_gba', "GBA Bowser's Castle 3"),
    new MarioKartWiiSceneDesc('old_donkey_64', "N64 DK's Jungle Parkway"),
    new MarioKartWiiSceneDesc('old_mario_gc', "GC Mario Circuit"),
    "Lightning Cup",
    new MarioKartWiiSceneDesc('old_mario_sfc', "SNES Mario Circuit 3"),
    new MarioKartWiiSceneDesc('old_garden_ds', "DS Peach Gardens"),
    new MarioKartWiiSceneDesc('old_donkey_gc', "GCN DK Mountain"),
    new MarioKartWiiSceneDesc('old_koopa_64', "N64 Bowser's Castle"),
    "Battle Courses",
    new MarioKartWiiSceneDesc('block_battle', "Block Plaza"),
    new MarioKartWiiSceneDesc('venice_battle', "Delfino Pier"),
    new MarioKartWiiSceneDesc('skate_battle', "Funky Stadium"),
    new MarioKartWiiSceneDesc('casino_battle', "Chain Chomp Wheel"),
    new MarioKartWiiSceneDesc('sand_battle', "Thwomp Desert"),
    new MarioKartWiiSceneDesc('old_battle4_sfc', "SNES Battle Course 4"),
    new MarioKartWiiSceneDesc('old_battle3_gba', "GBA Battle Course 3"),
    new MarioKartWiiSceneDesc('old_matenro_64', "N64 Skyscraper"),
    new MarioKartWiiSceneDesc('old_CookieLand_gc', "GCN Cookie Land"),
    new MarioKartWiiSceneDesc('old_House_ds', "DS Twilight House"),
    new MarioKartWiiSceneDesc('ring_mission', "Galaxy Colosseum"),
];

export const sceneGroup: Viewer.SceneGroup = { id, name, sceneDescs };
