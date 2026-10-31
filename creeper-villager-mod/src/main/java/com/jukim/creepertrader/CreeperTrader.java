package com.jukim.creepertrader;

import com.jukim.creepertrader.registry.ModEntities;
import com.jukim.creepertrader.registry.ModItems;
import net.fabricmc.api.ModInitializer;
import net.minecraft.resources.Identifier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** Mod entry point: registers the Creeper Trader entity and its spawn egg. */
public class CreeperTrader implements ModInitializer {
	public static final String MOD_ID = "creeper_trader";
	public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

	public static Identifier id(String path) {
		return Identifier.fromNamespaceAndPath(MOD_ID, path);
	}

	@Override
	public void onInitialize() {
		ModEntities.register();
		ModItems.register();
		LOGGER.info("Creeper Trader mod initialized, mod_id={}", MOD_ID);
	}
}
