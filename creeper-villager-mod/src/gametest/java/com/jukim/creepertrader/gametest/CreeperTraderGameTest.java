package com.jukim.creepertrader.gametest;

import com.jukim.creepertrader.entity.CreeperTraderEntity;
import com.jukim.creepertrader.registry.ModEntities;
import net.fabricmc.fabric.api.gametest.v1.GameTest;
import net.minecraft.core.BlockPos;
import net.minecraft.gametest.framework.GameTestHelper;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.Items;
import net.minecraft.world.item.trading.MerchantOffer;
import net.minecraft.world.level.GameType;

public class CreeperTraderGameTest {
	private static final BlockPos SPAWN = new BlockPos(1, 1, 1);

	@GameTest
	public void offersOnlyTnt(GameTestHelper helper) {
		CreeperTraderEntity trader = helper.spawn(ModEntities.CREEPER_TRADER, SPAWN);

		helper.assertTrue(trader.getOffers().size() == 3, "Expected 3 TNT offers");
		for (MerchantOffer offer : trader.getOffers()) {
			helper.assertTrue(offer.getResult().is(Items.TNT), "Every offer must sell TNT");
		}
		helper.assertFalse(trader.isIgnited(), "A fresh trader must be peaceful");
		helper.succeed();
	}

	@GameTest(maxTicks = 100)
	public void explodesAfterPlayerHit(GameTestHelper helper) {
		CreeperTraderEntity trader = helper.spawn(ModEntities.CREEPER_TRADER, SPAWN);
		Player player = helper.makeMockPlayer(GameType.SURVIVAL);

		trader.hurtServer(helper.getLevel(), helper.getLevel().damageSources().playerAttack(player), 1.0F);

		helper.assertTrue(trader.isIgnited(), "Trader must ignite when a player hits it");
		helper.succeedWhen(() -> helper.assertTrue(trader.isRemoved(), "Trader should have exploded"));
	}
}
