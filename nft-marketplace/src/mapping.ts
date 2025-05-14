import { store } from "@graphprotocol/graph-ts"
import {
  ItemListed,
  ItemBought,
  ItemCancelled,
} from "../generated/NFTmarketplace/NFTmarketplace"
import { ItemListed as ItemListedEntity, ItemBought as ItemBoughtEntity, ItemCancelled as ItemCancelledEntity } from "../generated/schema"

export function handleItemListed(event: ItemListed): void {
  const id = `${event.params.nftContract.toHex()}-${event.params.tokenId.toString()}`
  let entity = ItemListedEntity.load(id)
  if (entity == null) {
    entity = new ItemListedEntity(id)
  }
  entity.nftContract = event.params.nftContract
  entity.tokenId = event.params.tokenId
  entity.seller = event.params.seller
  entity.price = event.params.price
  entity.paymentToken = event.params.paymentToken
  entity.active = true
  entity.blockTimestamp = event.block.timestamp
  entity.save()
}

export function handleItemBought(event: ItemBought): void {
  const listingId = `${event.params.nftContract.toHex()}-${event.params.tokenId.toString()}`
  let listingEntity = ItemListedEntity.load(listingId)

  if (listingEntity) {
    // Mark the listing as inactive when bought
    listingEntity.active = false
    listingEntity.save()
  }

  // Create the bought record for history
  const boughtId = `${event.transaction.hash.toHex()}-${event.logIndex.toString()}`
  let boughtEntity = new ItemBoughtEntity(boughtId)
  boughtEntity.nftContract = event.params.nftContract
  boughtEntity.tokenId = event.params.tokenId
  boughtEntity.buyer = event.params.buyer
  boughtEntity.seller = event.params.seller
  boughtEntity.price = event.params.price
  boughtEntity.paymentToken = event.params.paymentToken
  boughtEntity.timestamp = event.block.timestamp
  boughtEntity.save()
}

export function handleItemCancelled(event: ItemCancelled): void {
  const listingId = `${event.params.nftContract.toHex()}-${event.params.tokenId.toString()}`
  let listingEntity = ItemListedEntity.load(listingId)
  if (listingEntity) {
    // Mark the listing as inactive when cancelled
    listingEntity.active = false
    listingEntity.save()
  }

  // Create cancelled record
  const cancelledId = `${event.params.nftContract.toHex()}-${event.params.tokenId.toString()}`
  let entity = new ItemCancelledEntity(cancelledId)
  entity.seller = event.params.seller
  entity.nftContract = event.params.nftContract
  entity.tokenId = event.params.tokenId
  entity.save()
}