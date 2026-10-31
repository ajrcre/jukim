package com.jukim.creepertrader.registry;

import com.jukim.creepertrader.CreeperTrader;
import net.fabricmc.fabric.api.creativetab.v1.CreativeModeTabEvents;
import net.minecraft.core.Registry;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.core.registries.Registries;
import net.minecraft.resources.ResourceKey;
import net.minecraft.world.item.CreativeModeTabs;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.SpawnEggItem;

/** Registry for the mod's items. */
public final class ModItems {
	private static final ResourceKey<Item> SPAWN_EGG_KEY =
		ResourceKey.create(Registries.ITEM, CreeperTrader.id("creeper_trader_spawn_egg"));

	public static final Item CREEPER_TRADER_SPAWN_EGG = Registry.register(
		BuiltInRegistries.ITEM,
		SPAWN_EGG_KEY,
		new SpawnEggItem(new Item.Properties().setId(SPAWN_EGG_KEY).spawnEgg(ModEntities.CREEPER_TRADER))
	);

	private ModItems() {
	}

	public static void register() {
		CreativeModeTabEvents.modifyOutputEvent(CreativeModeTabs.SPAWN_EGGS)
			.register(output -> output.accept(CREEPER_TRADER_SPAWN_EGG));
	}
}
