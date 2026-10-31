package com.jukim.creepertrader.client;

import com.jukim.creepertrader.registry.ModEntities;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.rendering.v1.ModelLayerRegistry;
import net.minecraft.client.renderer.entity.EntityRenderers;

/** Client entry point: model layer and renderer. */
public class CreeperTraderClient implements ClientModInitializer {
	@Override
	public void onInitializeClient() {
		ModelLayerRegistry.registerModelLayer(CreeperTraderModel.LAYER, CreeperTraderModel::createBodyLayer);
		EntityRenderers.register(ModEntities.CREEPER_TRADER, CreeperTraderRenderer::new);
	}
}
